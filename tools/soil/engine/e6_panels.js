
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
// a title (textBaseline top): its own size when it fits, else smaller to fit, down to min, on the same baseline;
// below that, with two, on two lines split where they are most even (as large as fits); else cut short at min.
// Returns its height: lh for one line, lh plus a line for two.
function fitTitle(ctx, text, x, y, maxW, px, lh, color, weight, min, two) {
  text = String(text); ctx.fillStyle = color || VC.ink;
  const size = L => {   // the largest size from px down to min at which every line fits, else 0
    ctx.font = vfont(px, weight);
    let s = Math.min(px, Math.floor(px * maxW / Math.max(...L.map(l => ctx.measureText(l).width))));
    for (; s >= min; s--) { ctx.font = vfont(s, weight); if (L.every(l => ctx.measureText(l).width <= maxW)) return s; }
    return 0;
  };
  let s = size([text]);
  if (!s && two) {
    const wd = text.split(' ');
    let L = null, m = Infinity;
    ctx.font = vfont(px, weight);
    for (let k = 1; k < wd.length; k++) {
      const p = [wd.slice(0, k).join(' '), wd.slice(k).join(' ')], v = Math.max(...p.map(l => ctx.measureText(l).width));
      if (v < m) { m = v; L = p; }
    }
    if (L && (s = size(L))) {
      const y0 = y + Math.round((px - s) * 0.8), l2 = Math.round(lh * s / px);
      L.forEach((l, k) => ctx.fillText(l, x, y0 + k * l2));
      return lh + l2;
    }
  }
  s = s || min; ctx.font = vfont(s, weight);
  ctx.fillText(fitText(ctx, text, maxW), x, y + Math.round((px - s) * 0.8));   // (B612's baseline is 0.8 of its size down)
  return lh;
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
  const P = { w, h, cv, ctx: cv.getContext('2d'), tex, mesh, draw, sig, regions: [], hover: null, last: '', t: 0, inScene: false };
  P.at = (x, y) => {
    for (let k = P.regions.length - 1; k >= 0; k--) {
      const r = P.regions[k];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
    }
    return null;
  };
  return P;
}
// a story panel in the scene or on top, as the cards setting says: in 3D, it stands in the scene as the labels' signs do
// (depth-tested and writing depth, drawn first of the see-through things, its clear corners cut away), so what stands
// in front of it hides it and it hides what is behind it; otherwise it is drawn over everything. Set only when that
// changes (a new alphaTest needs the material built again)
function panelDepth(P, inScene) {
  if (P.inScene === inScene) return;
  const m = P.mesh.material;
  P.inScene = m.depthTest = m.depthWrite = inScene;
  m.alphaTest = inScene ? 0.1 : 0; m.needsUpdate = true;
  P.mesh.renderOrder = inScene ? -1 : 50;
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
    let s = 's' + audioLabel() + xrSig() + (HOST.room && HOST.room.inRoom() ? 'r' + HOST.room.gripHint : '') + (curCh ? curCh.key : '');
    if (it) {
      for (const e of it.els) s += Math.round(Math.max(0, e.o) * 3);
      for (const g of it.grow) s += Math.round(Math.max(0, g.s) * 6);
      if (curCh.key === 'title') s += $('#titleArc').getAttribute('stroke-dashoffset').slice(0, 3) + $('#titleDot').getAttribute('opacity').slice(0, 3);
    }
    return s;
  }
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), X.mod, X.rho, X.shuf, X.kind, X.plot, XR.on].join('|');
}
const XR_HERE = 'soil';
const XR_STORIES = HOST.list;
// ------------------------------------------------------- headset landing --
// The Stories screen in the headset: a title panel and one card per story,
// floating in an arc in front of you while the story itself is hidden.
function xrLandingSetup() {
  XR.land = [];
  XR.landGroup = new THREE.Group();
  GL.rig.add(XR.landGroup);
  const head = makePanel(1400, 300, 1.02, drawLandHead, () => 'h' + XR.inStory + audioLabel() + HOST.repeat + XR.soundCheck + HOST.audio.muted + HOST.anchor.status() + HOST.list.length);
  head.mesh.position.set(0, 0.36, -1.22);
  XR.landGroup.add(head.mesh); XR.land.push(head); XR.panels.push(head);
  xrLandingCards();
  // Sound check (opened from the header), in the place of the story cards
  XR.snd = makePanel(1400, 860, 1.02, drawSoundCheck, () => (XR.snd.mesh.visible ? 'snd' + Math.floor(performance.now() / 500) : 'off'));
  XR.snd.mesh.position.set(0, -0.17, -1.2);
  XR.landGroup.add(XR.snd.mesh); XR.panels.push(XR.snd);
  XR.panelMeshes = XR.panels.map(P => P.mesh);
}
// One card per story, 0.36 m wide, on an arc for any number of stories: neighbours 0.381 m apart and the outer ones at
// most 62° to the side (fifteen: 0.155 rad apart at 2.46 m), never nearer than 1.25 m (a few stories stand closer
// together in angle). Built again when the shell's list of stories changes while the app runs (HOST.listRev: a story
// added in a release gets its card)
function xrLandingCards() {
  for (const P of XR.land.splice(1)) {
    XR.landGroup.remove(P.mesh); XR.panels.splice(XR.panels.indexOf(P), 1);
    P.tex.dispose(); P.mesh.geometry.dispose(); P.mesh.material.dispose();
  }
  const n = HOST.list.length, d = Math.max(1.25, n > 1 ? 0.1905 / Math.sin(1.085 / (n - 1)) : 0), step = 2 * Math.asin(0.1905 / d);
  XR.landRev = HOST.listRev;
  HOST.list.forEach((s, k) => {
    const a = (k - (n - 1) / 2) * step;
    const P = makePanel(640, 820, 0.36, (ctx, P) => drawLandCard(ctx, P, s), () => 'c' + XR.inStory + s.key);
    P.mesh.position.set(Math.sin(a) * d, -0.105, -Math.cos(a) * d);   // top edge 0.126 m up, under the header
    P.mesh.rotation.y = -a;
    XR.landGroup.add(P.mesh); XR.land.push(P); XR.panels.push(P);
  });
  XR.panelMeshes = XR.panels.map(P => P.mesh);
}
// leave the Stories screen: back into this story (resumed, or started if it never ran)
function xrLandingClose() {
  XR.stories = false;
  // at a shared room's station the story goes on as the room has it: a restart here would restart it for everyone (in
  // a room a story runs only at its station, on the station's clock)
  if (!XR.inStory && !HOST.collab.mine() && !xrRoomOnly()) APP.enterStory(0);
  XR.inStory = true;
  if (APP.mode === 'story' && !xrRoomOnly()) APP.playing = true;
}
function drawLandHead(ctx, P) {
  ctx.font = vfont(58, 700); ctx.fillStyle = VC.ink; ctx.fillText(`Networks, in ${['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
    'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'][HOST.list.length - 1] || HOST.list.length} stories`, 48, 44);
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
  fitTitle(ctx, s.kick.toUpperCase(), 48, 64, P.w - 96, 28, 34, s.col, 700, 22);
  // a long title shrinks a little, else takes two lines and the description moves down (ending above the length)
  const dy = 112 + fitTitle(ctx, s.title, 46, 112, P.w - 94, 72, 78, VC.ink, 700, 58, true) + 32;
  textBlock(ctx, s.desc, 48, dy, P.w - 96, 31, 45, VC.muted, 400, Math.min(7, Math.floor((P.h - 243 - dy) / 45) + 1));
  ctx.font = vfont(26); ctx.fillStyle = VC.faint; ctx.fillText(fitText(ctx, s.len, P.w - 96), 48, P.h - 196);
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
    let yw = 0;   // the kicker stops short of 'You are here' beside it
    if (here) { ctx.font = vfont(22); ctx.fillStyle = VC.cyan; ctx.textAlign = 'right'; ctx.fillText('You are here', x + W - 26, y + 26); ctx.textAlign = 'left'; yw = ctx.measureText('You are here').width + 20; }
    fitTitle(ctx, kick.toUpperCase(), x + 26, y + 22, W - 52 - yw, 21, 26, col, 700, 17);
    fitTitle(ctx, title, x + 26, y + 54, W - 52, 38, 44, VC.ink, 700, 30);
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
  // in a shared room no Stories button: each station keeps its story, and another story is another station (walk into
  // its circle)
  if (!(HOST.room && HOST.room.placing()) && !xrRoomOnly()) hb('stories', 'Stories', () => { XR.stories = true; XR.kbd.open = false; APP.playing = false; }, 130);
  if (!XR.stories) hb('mode', story ? 'Explore now' : 'Replay story', () => (story ? APP.enterExplore() : APP.enterStory(0)), 186, { primary: story });
  // the story's name, smaller when the buttons leave it less room
  fitTitle(ctx, 'Holding on to nitrogen', 40, 36, x - 40, 30, 36, VC.ink, 700, 24);
  ctx.fillStyle = VC.line; ctx.fillRect(36, 104, P.w - 72, 2);
  if (XR.stories) drawStoriesPane(ctx, P, 44, 136, P.w - 88);
  else if (story) {
    drawStoryPane(ctx, P, 44, 136, P.w - 88);
    ctx.fillStyle = VC.line; ctx.fillRect(36, P.h - 96, P.w - 72, 2);
    textBlock(ctx, HOST.room && HOST.room.inRoom() ? HOST.room.gripHint : HOST.anchor.on ? 'Trigger (or pinch): use buttons. A or X: play and pause. Anchored: to move things, use Place again on the Stories screen.' : XR.free ? 'Trigger (or pinch): use buttons. Grip: hold the scene or this panel to move and turn it; both grips on the scene resize it. A or X: play and pause.' : 'Trigger (or pinch): use buttons. Grip: move the scene or this panel; both grips on the scene resize it. A or X: play and pause.', 44, P.h - 74, P.w - 88, 22, 30, VC.faint);
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
  ({ field: drawFieldPane, nitrogen: drawNitrogenPane, microbes: drawMicrobesPane, network: drawNetworkPane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
// buttons that wrap like the HTML chips: items -> { id, label, on, col, ink, fn } (no fn: a plain chip)
function flow(ctx, P, items, x, y, W, maxY, o = {}) {
  const px = o.px || 22, h = o.h || 44, gap = 8;
  let cx = x, cy = y;
  for (const it of items) {
    ctx.font = vfont(px, it.on ? 700 : 400);   // (a lit chip's bold label is wider)
    const sw = it.col ? 22 : 0, w = Math.min(W, ctx.measureText(it.label).width + 26 + sw);
    if (cx + w > x + W) { cx = x; cy += h + gap; }
    if (cy + h > maxY) break;
    vButton(ctx, P, it.id, cx, cy, w, h, '', it.fn, { r: 6, on: it.on });
    if (it.col) swatch(ctx, cx + 12, cy + h / 2 - 7, 14, it.col);
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
// rows of a name (muted) and its value (ink), as the HTML's dl.stats
// (kw: the names' column, wider where they are long, as the windows of radii)
function stats(ctx, x, y, W, rows, kw = 220) {
  let yy = y;
  for (const [k, v, more] of rows) {
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, k, kw - 10), x, yy + 3);
    ctx.font = vfont(25, 700); ctx.fillStyle = VC.ink; ctx.fillText(v, x + kw, yy);
    if (more) { const w = ctx.measureText(v).width; ctx.font = vfont(21); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, more, W - kw - 20 - w), x + kw + 16 + w, yy + 4); }
    yy += 38;
  }
  return yy - y;
}
// a slider the panes hold (a radius or an end of the window): its name, its value and the slider under them (a radius
// slides on the log ruler, as on the page)
function numRow(ctx, P, key, x, y, W) {
  const o = NUM[key], v = numOf(key);
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(o.label, x, y + 2);
  ctx.font = vfont(24, 700); ctx.fillStyle = VC.ink; ctx.textAlign = 'right'; ctx.fillText(o.text(v), x + W, y); ctx.textAlign = 'left';
  vSlider(ctx, P, 'num:' + key, x + 14, y + 28, W - 28, sOf(o, v), o.log ? 0 : o.min, o.log ? 1000 : o.max, o.col, s => setNum(key, vOf(o, s), true));
  return 28 + 48 + 12;
}
// a closing note in the room left, if any
const footNote = (ctx, text, x, y, W, bottom) => { if (y + 60 < bottom) textBlock(ctx, text, x, y, W, 21, 29, VC.faint, 400, Math.max(1, Math.min(4, Math.floor((bottom - y) / 29)))); };
// the explore panes' canvas twins (Field, Nitrogen, Microbes, Network, Scenes): the same choices and numbers as the HTML
// panes (renderField and the others in e4_explore.js); keep both twins in step
// (the chips of a control of a scene; cols(o) a swatch's colour)
const ctlChips = (k, key, cols, onIf) => ctlOf(k, key).options.map(([o, n]) => ({ id: k + ':' + key + ':' + o, label: n, col: cols ? cols(o) : null,
  on: (onIf ? onIf() : true) && ctlValue(k, ctlOf(k, key)) === o, fn: () => sceneCtl(k, key, o) }));
function drawFieldPane(ctx, P, x, y, W, bottom) {
  const on = X.scene === 'field', I = fieldInfo(), o = { px: 21, h: 44 };
  y += textBlock(ctx, `The trial's ${FACTS.plots} plots: two wheats, three regimes, ${word(FACTS.reps)} plots of each. Point at a plot and pull the trigger to pick its group.`, x, y, W, 23, 32, VC.muted, 400, 2) + 8;
  y += head(ctx, x, y, 'Date');
  y += flow(ctx, P, ctlChips('field', 'date'), x, y, W, bottom, o) + 8;
  y += head(ctx, x, y, 'Show');
  y += flow(ctx, P, ctlChips('field', 'show').map(c => Object.assign(c, { fn: () => pickShow(c.id.split(':')[2]) })), x, y, W, bottom, o) + 8;
  y += head(ctx, x, y, 'Wheat and regime');
  y += flow(ctx, P, ctlChips('field', 'line', v => (v === '0' ? LINE_COL[0] : v === '1' ? LINE_COL[1] : null)).concat(
    ctlChips('field', 'fert', v => (v === 'all' ? null : FERT_COL[+v]))), x, y, W, bottom, o) + 8;
  y += head(ctx, x, y, 'View');
  y += flow(ctx, P, ctlChips('field', 'view', null, () => on).map(c => Object.assign(c, { fn: () => showView('field', c.id.split(':')[2]) })), x, y, W, bottom, o) + 12;
  y += textBlock(ctx, I.head, x, y, W, 26, 34, VC.ink, 700, 1) + 2;
  y += textBlock(ctx, I.sub, x, y, W, 21, 28, VC.muted, 400, 1) + 6;
  y += stats(ctx, x, y, W, I.rows) + 6;
  if (I.jars) { y += head(ctx, x, y, 'The jars\' peaks (read off the slides): BNI · control'); y += stats(ctx, x, y, W, I.jars) + 6; }
  if (I.pick && y + 140 < bottom) {
    y += textBlock(ctx, I.pick.head, x, y, W - 140, 25, 34, I.pick.col, 700, 1) + 4;
    vButton(ctx, P, 'plot:none', x + W - 120, y - 44, 120, 40, 'None', () => selectPlot(-1), { px: 20, r: 6 });
    y += stats(ctx, x, y, W, I.pick.rows) + 6;
  }
  footNote(ctx, NOTE.field(fieldShow()), x, y, W, bottom);
}
function drawNitrogenPane(ctx, P, x, y, W, bottom) {
  const on = X.scene === 'soil';
  y += textBlock(ctx, 'A sketch, not data: the soil block with fertiliser, the BNI wheat\'s roots and the synthetic inhibitor. Switch them, and watch where the nitrogen goes.', x, y, W, 24, 34, VC.muted, 400, 3) + 14;
  for (const c of ctlsOf('soil')) {
    y += head(ctx, x, y, c.label);
    y += flow(ctx, P, ctlChips('soil', c.key, null, () => c.key !== 'view' || on), x, y, W, bottom, { px: 23, h: 54 }) + 14;
  }
  y += flow(ctx, P, [{ id: 'replay', label: 'Replay the flows', fn: () => { X.t0 = performance.now(); } }], x, y, W, bottom, { px: 23, h: 54 }) + 18;
  footNote(ctx, NOTE.nitrogen, x, y, W, bottom);
}
function drawMicrobesPane(ctx, P, x, y, W, bottom) {
  const col = ctlv('net', 'colour'), K2 = kindInfo();
  y += textBlock(ctx, `About ${thousands(FACTS.kinds)} kinds of microbe as a cloud: the ${fmt(FACTS.common)} common ones (${pct(FACTS.readShare)} of the reads) in its core. Point at a kind and pull the trigger to pick it.`, x, y, W, 23, 32, VC.muted, 400, 3) + 10;
  y += head(ctx, x, y, 'Colour');
  y += flow(ctx, P, [['phylum', 'Phylum'], ['guild', 'Nitrifiers']].map(([o, n]) => ({ id: 'col:' + o, label: n, on: col === o, fn: () => sceneCtl('net', 'colour', o) }))
    .concat([{ id: 'crowd', label: 'The crowd', on: X.scene === 'net' && netView() === 'cloud', fn: () => showView('net', 'cloud') }]), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  y += head(ctx, x, y, 'The nitrifiers\' share of reads: not fertilised · fertilised · + DCD');
  ctx.font = vfont(21);
  for (const [n, v, more] of guildRows()) {
    if (y + 60 > bottom) break;
    ctx.font = vfont(22, 700); ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, n, W * 0.48), x, y);
    ctx.font = vfont(22); ctx.fillText(v, x + W * 0.5, y);
    ctx.font = vfont(19); ctx.fillStyle = VC.muted; ctx.fillText(more, x + W * 0.5, y + 27);
    y += 58;
  }
  y += 8;
  if (K2) {
    y += textBlock(ctx, K2.head, x, y, W - 140, 26, 34, VC.cyan, 700, 1) + 4;
    vButton(ctx, P, 'kind:none', x + W - 120, y - 44, 120, 40, 'None', () => selectKind(-1), { px: 20, r: 6 });
    y += stats(ctx, x, y, W, K2.rows) + 8;
  } else y += textBlock(ctx, 'No kind picked.', x, y, W, 22, 30, VC.muted, 400, 1) + 8;
  footNote(ctx, NOTE.microbes, x, y, W, bottom);
}
function drawNetworkPane(ctx, P, x, y, W, bottom) {
  const col = ctlv('net', 'colour'), M = X.mod >= 0 ? moduleInfo(X.mod) : null, o = { px: 22, h: 48 };
  y += textBlock(ctx, `The ${fmt(FACTS.nodes)} kinds that rise and fall together across the ${FACTS.samples} samples. Pick a module to light the plots where it thrives.`, x, y, W, 23, 32, VC.muted, 400, 2) + 8;
  y += head(ctx, x, y, 'Colour');
  y += flow(ctx, P, [['module', 'Module'], ['phylum', 'Phylum'], ['guild', 'Nitrifiers']].map(([v, n]) => ({ id: 'col:' + v, label: n, on: col === v, fn: () => sceneCtl('net', 'colour', v) })), x, y, W, bottom, o) + 8;
  y += head(ctx, x, y, 'Module');
  y += flow(ctx, P, BIG.map(m => ({ id: 'mod:' + m, label: `${m + 1}`, col: SLOOK.module(m), on: X.mod === m, fn: () => selectModule(m) }))
    .concat([{ id: 'mod:prev', label: '‹', fn: () => stepModule(-1) }, { id: 'mod:next', label: '›', fn: () => stepModule(1) }, { id: 'mod:none', label: 'None', on: X.mod < 0, fn: () => selectModule(-1) }]), x, y, W, bottom, o) + 8;
  if (M) { y += textBlock(ctx, M.head, x, y, W, 25, 33, M.col, 700, 1) + 2; y += stats(ctx, x, y, W, M.rows, 170) + 4; }
  y += numRow(ctx, P, 'rho', x, y, W);
  y += flow(ctx, P, [{ id: 'shuf', label: X.shuf ? 'Unshuffle' : 'Shuffle the samples', on: !!X.shuf, fn: () => setShuffle(!X.shuf) }], x, y, W, bottom, o) + 8;
  y += head(ctx, x, y, 'Split by');
  y += flow(ctx, P, SPLIT_OPTS.map(([v, n]) => ({ id: 'split:' + v, label: n, on: splitNow() === v, fn: () => setSplit(v) })), x, y, W, bottom, o) + 8;
  y += stats(ctx, x, y, W, netInfo().rows, 200) + 6;
  footNote(ctx, NOTE.network, x, y, W, bottom);
}
// the five scenes, and the chosen scene's own controls (its sliders too); explore's About at its foot, room kept for it
function drawScenesPane(ctx, P, x, y, W, bottom) {
  ctx.font = vfont(21);
  const end = bottom - 34 - wrapLines(ctx, ABOUT, W).length * 29;
  head(ctx, x, end, 'About');
  textBlock(ctx, ABOUT, x, end + 34, W, 21, 29, VC.faint);
  bottom = end - 16;
  const cw = (W - 12 * (SCENES.length - 1)) / SCENES.length;
  SCENES.forEach(([k, n], j) => vButton(ctx, P, 'scene:' + k, x + j * (cw + 12), y, cw, 56, SCENE_SHORT[k] || n, () => openScene(k), { on: X.scene === k, px: 22 }));
  y += 76;
  const sc = SCENES.find(s => s[0] === X.scene);
  y += textBlock(ctx, sc[2], x, y, W, 25, 35, VC.muted, 400, 4) + 18;
  for (const c of ctlsOf(X.scene).filter(c => ctlShown(X.scene, c))) {
    if (y + 110 > bottom) break;
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(c.label, x, y);
    y += 36;
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlValue(X.scene, c) === v, fn: () => sceneCtl(X.scene, c.key, v) })), x, y, W, bottom, { px: 24, h: 56 }) + 24;
  }
  for (const key of Object.keys(NUM).filter(k => numShown(X.scene, k))) if (y + 90 < bottom) y += numRow(ctx, P, key, x, y, W);
}

// ----------------------------------------------------------- footer panel --
function sigFoot() {
  return APP.mode === 'story' ? 's' + Math.round(APP.t * 4) + APP.playing + (curCh ? curCh.key : '') + slideSig() : 'x' + X.turn;
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
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.textAlign = 'right'; ctx.fillText(m(t) + ' / ' + m(T_END), x1, 44); ctx.textAlign = 'left';
    // this story's Slideshow switch, left of the clock (placed for the longest clock, so it never shifts)
    const sx = x1 - ctx.measureText(m(T_END) + ' / ' + m(T_END)).width - 220;
    if (HOST.slides) vButton(ctx, P, 'slides', sx, 26, 198, 42, 'Slideshow: ' + (slidesOn() ? 'on' : 'off'), slideToggle, { on: slidesOn(), px: 20 });
    // slideshow: waiting at the end of a chapter, Next in the place of the chapter's name (the panel above has it)
    if (SLIDE.at >= 0) vButton(ctx, P, 'slideNext', x0, 16, 180, 48, 'Next', slideNext, { primary: true, px: 28 });
    else { ctx.font = vfont(27, 700); ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, CH[ci].name, (HOST.slides ? sx : x1 - 160) - 16 - x0), x0, 40); }
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


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
  if (APP.mode !== 'story') return ['x', LANG, audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), X.n, X.shark, GL.sets.fish.sharkOn(), !!GL.lifeOn, JSON.stringify(X.out), Math.floor(X.out.day), X.city, X.prot].join('|');
  {
    const it = ST.items.find(x => x.ch === curCh);
    let s = 's' + LANG + audioLabel() + xrSig() + (GL.lifeOn ? 'f' : '') + (HOST.room && HOST.room.inRoom() ? 'r' + HOST.room.gripHint : '') + (curCh ? curCh.key : '');
    if (it) {
      for (const e of it.els) s += Math.round(Math.max(0, e.o) * 3);
      for (const g of it.grow) s += Math.round(Math.max(0, g.s) * 6);
      if (curCh.key === 'fish') s += $('#titleArc').getAttribute('stroke-dashoffset').slice(0, 3) + $('#titleDot').getAttribute('opacity').slice(0, 3);
    }
    return s;
  }
}
const XR_HERE = 'pass';
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
  fitTitle(ctx, T('title'), 40, 36, x - 40, 30, 36, VC.ink, 700, 24);
  ctx.fillStyle = VC.line; ctx.fillRect(36, 104, P.w - 72, 2);
  if (XR.stories) drawStoriesPane(ctx, P, 44, 136, P.w - 88);
  else if (story) {
    drawStoryPane(ctx, P, 44, 136, P.w - 88);
    ctx.fillStyle = VC.line; ctx.fillRect(36, P.h - 96, P.w - 72, 2);
    textBlock(ctx, HOST.room && HOST.room.inRoom() ? (GL.lifeOn && !HOST.anchor.locked('sea') ? T('xr.hint.fish.room') : HOST.room.gripHint) : HOST.anchor.on ? T('xr.hint.anchor') : GL.lifeOn ? T(XR.free ? 'xr.hint.fish.free' : 'xr.hint.fish') : T(XR.free ? 'xr.hint.free' : 'xr.hint'), 44, P.h - 80, P.w - 88 - 320, 21, 28, VC.faint, 400, 3);
  } else { drawExplorePane(ctx, P, 40, 120, P.w - 80); ctx.fillStyle = VC.line; ctx.fillRect(36, P.h - 96, P.w - 72, 2); }
  if (!XR.stories) drawLang(ctx, P, P.w - 44, P.h - 82);
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


// explore: the language, tabs and panes mirroring the HTML ones
function drawExplorePane(ctx, P, x, y, W) {
  const tw = W / TABS.length;
  TABS.forEach(([k, n], j) => {
    const on = X.tab === k, tx = x + j * tw, hov = P.hover === 'tab:' + k;
    if (hov && !on) { rr(ctx, tx + 4, y, tw - 8, 62, 8); ctx.fillStyle = VC.chip; ctx.fill(); }
    ctx.font = vfont(24, on ? 700 : 400); ctx.fillStyle = on ? VC.ink : VC.muted;
    ctx.textAlign = 'center'; ctx.fillText(T(n), tx + tw / 2, y + 18); ctx.textAlign = 'left';
    if (on) { ctx.fillStyle = VC.cyan; ctx.fillRect(tx + 10, y + 58, tw - 20, 4); }
    P.regions.push({ id: 'tab:' + k, x: tx, y, w: tw, h: 64, fn: () => pickTab(k) });
  });
  ctx.fillStyle = VC.line; ctx.fillRect(x, y + 62, W, 2);
  y += 88;
  const bottom = P.h - 108;   // (the language switch below)
  ({ fish: drawFishPane, outbreak: drawOutbreakPane, cell: drawCellPane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
// the language switch at the foot of the main panel (story and explore alike)
function drawLang(ctx, P, x1, y) {
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(T('lang'), x1 - 2 * 86 - 14, y + 28); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  LANGS.forEach((l, i) => vButton(ctx, P, 'lang:' + l, x1 - (2 - i) * 86, y, 78, 56, l.toUpperCase(), () => setLang(l), { on: LANG === l, px: 24 }));
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
function stats(ctx, x, y, W, rows) {
  let yy = y;
  for (const [k, v, more] of rows) {
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(k, x, yy + 3);
    ctx.font = vfont(25, 700); ctx.fillStyle = VC.ink; ctx.fillText(v, x + 220, yy);
    if (more) { const w = ctx.measureText(v).width; ctx.font = vfont(21); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, more, W - 240 - w), x + 236 + w, yy + 4); }
    yy += 38;
  }
  return yy - y;
}
// a name and its value on one line (the value bold, at the right)
function headVal(ctx, x, y, w, k, v) {
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, k, w - 120), x, y);
  if (v !== undefined) { ctx.font = vfont(24, 700); ctx.fillStyle = VC.ink; ctx.textAlign = 'right'; ctx.fillText(String(v), x + w, y - 2); ctx.textAlign = 'left'; }
  return 34;
}
// the fish: be the shark, neighbours watched, the network, the school's size, the view
function drawFishPane(ctx, P, x, y, W, bottom) {
  const busy = GL.sets.fish.sharkOn(), k = fishK(), vc = ctlOf('fish', 'view'), lc = ctlOf('fish', 'links');
  y += textBlock(ctx, T('f.sub'), x, y, W, 24, 33, VC.muted, 400, 2) + 14;
  y += head(ctx, x, y, T('f.shark'));
  y += flow(ctx, P, [['off', T('off')], ['on', T('on')]].map(([v, n]) => ({ id: 'shark:' + v, label: n, on: X.shark === (v === 'on'), fn: () => setShark(v === 'on') }))
    .concat([{ id: 'send', label: busy ? T('f.busy') : T('f.send'), on: busy, fn: busy ? null : () => sendShark(null) }]), x, y, W, bottom, { px: 23, h: 54 }) + 10;
  if (X.shark) y += textBlock(ctx, T('f.shark.how'), x, y, W, 22, 30, VC.faint, 400, 3) + 10;
  y += headVal(ctx, x, y, W, T('f.k'), k);
  vSlider(ctx, P, 'fk', x + 16, y, W - 32, k, 1, 12, VC.cyan, v => setFishK(v));
  y += 54;
  y += textBlock(ctx, kText(k), x, y, W, 23, 31, k === 1 ? VC.amber : VC.ink, 400, 2) + 14;
  y += head(ctx, x, y, T('f.links'));
  y += flow(ctx, P, lc.options.map(([v, n]) => ({ id: 'links:' + v, label: n, on: ctlValue('fish', lc) === v, fn: () => sceneCtl('fish', 'links', v) })), x, y, W, bottom, { px: 23, h: 54 }) + 14;
  y += headVal(ctx, x, y, W, T('f.n'), X.n);
  vSlider(ctx, P, 'fn', x + 16, y, W - 32, X.n, 100, 600, VC.cyan, v => setFishN(v));
  y += 58;
  y += head(ctx, x, y, vc.label);
  y += flow(ctx, P, vc.options.map(([v, n]) => ({ id: 'fv:' + v, label: n, on: ctlValue('fish', vc) === v, fn: () => sceneCtl('fish', 'view', v) })), x, y, W, bottom, { px: 23, h: 54 }) + 14;
  if (y + 60 < bottom) textBlock(ctx, T('f.note'), x, y, W, 21, 29, VC.faint, 400, Math.max(1, Math.min(4, Math.floor((bottom - y) / 29))));
}
// the outbreak's chart, as the HTML one: cities in each state by day, stacked, and the day on show
function drawChart(ctx, x, y, w, h, n) {
  ctx.fillStyle = 'rgba(160,178,202,0.35)'; ctx.fillRect(x, y + h, w, 2);
  for (const [k, pts] of chartPaths(n, w, h)) {
    ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(x + px, y + py) : ctx.moveTo(x + px, y + py))); ctx.closePath();
    ctx.globalAlpha = 0.85; ctx.fillStyle = OUT_COL[k]; ctx.fill(); ctx.globalAlpha = 1;
  }
  const dx = x + (n.d / Math.max(1, n.end)) * w;
  ctx.fillStyle = VC.ink; ctx.fillRect(dx - 1.5, y - 6, 3, h + 6);
  ctx.font = vfont(19); ctx.fillStyle = VC.muted; ctx.fillText(num(n.total), x, y - 28);
  ctx.textAlign = 'right'; ctx.fillText(T('o.day', n.end), x + w, y + h + 8); ctx.textAlign = 'left'; ctx.fillText(T('o.day', 0), x, y + h + 8);
  // the legend, at the top right
  let lx = x + w;
  ctx.textAlign = 'right';
  for (const k of ['R', 'I', 'E']) { const t = T('o.' + k); ctx.fillText(t, lx, y - 28); lx -= ctx.measureText(t).width + 8; swatch(ctx, lx - 16, y - 26, 16, OUT_COL[k]); lx -= 34; }
  ctx.textAlign = 'left';
}
// the outbreak: where it starts, what a click does, play, the day, the chart, how far it has come, the city looked
// up, and the settings, two by two
function drawOutbreakPane(ctx, P, x, y, W, bottom) {
  const O = X.out, n = outNow(), st = outIndex(O.start), sf = st >= 0 ? api('globe').info(st) : null, hw = (W - 32) / 2;
  y += textBlock(ctx, T('o.sub'), x, y, W, 25, 32, VC.amber, 700, 1) + 10;
  y += headVal(ctx, x, y, W, T('o.start'), sf ? `${sf.city} (${sf.code})` : O.start);
  y += flow(ctx, P, QUICK_START.filter(c => outIndex(c) >= 0).map(c => ({ id: 'st:' + c, label: cityOf(c), on: c === O.start, fn: () => setStart(c) })), x, y, W, y + 50, { px: 22, h: 48 }) + 12;
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; const cw = ctx.measureText(T('o.click')).width + 18; ctx.fillText(T('o.click'), x, y + 15);
  y += flow(ctx, P, [['start', T('o.click.start')], ['look', T('o.click.look')]].map(([v, l]) => ({ id: 'ck:' + v, label: l, on: O.click === v, fn: () => { X.out.click = v; renderOutbreak(); } })), x + cw, y, W - cw, bottom, { px: 22, h: 48 }) + 12;
  vButton(ctx, P, 'oplay', x, y, 200, 56, O.playing ? T('o.pause') : T('o.play'), () => playOut(!X.out.playing), { primary: true, px: 25 });
  vButton(ctx, P, 'oagain', x + 214, y, 200, 56, T('o.again'), () => { X.out.day = 0; playOut(true); }, { px: 23 });
  ctx.font = vfont(30, 700); ctx.fillStyle = VC.ink; ctx.textAlign = 'right'; ctx.fillText(T('o.day', n.d), x + W, y + 12); ctx.textAlign = 'left';
  y += 66;
  vSlider(ctx, P, 'oday', x + 16, y, W - 32, n.d, 0, Math.max(1, n.end), VC.ink, v => setDay(Math.round(v)));
  y += 84;
  drawChart(ctx, x, y, W, 130, n);
  y += 130 + 42;
  // (rows of a name and its value, the values lined up after the longest name)
  ctx.font = vfont(22);
  const rows = [[T('o.reached'), T('o.reachedv', num(n.reached), num(FACTS.airports))], [T('o.peak'), T('o.peakv', num(n.peak), n.peakDay)], [T('o.over'), T('o.overv', n.end)]];
  const lw = Math.max(...rows.map(r => ctx.measureText(r[0]).width)) + 18;
  rows.slice(0, 2).forEach(([k, v], i) => {
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(k, x, y + 3);
    ctx.font = vfont(25, 700); ctx.fillStyle = VC.ink; ctx.fillText(v, x + lw, y);
    if (i === 1) { ctx.font = vfont(21); ctx.fillStyle = VC.muted; ctx.textAlign = 'right'; ctx.fillText(`${rows[2][0]} ${rows[2][1]}`, x + W, y + 4); ctx.textAlign = 'left'; }
    y += 38;
  });
  y += 4;
  const [ca, cb] = cityText();
  if (ca) { y += textBlock(ctx, ca, x, y, W, 23, 30, VC.cyan, 700, 1); if (cb) y += textBlock(ctx, cb, x, y, W, 21, 28, VC.muted, 400, 1); y += 10; }
  // the settings, two by two
  const pair = (l, r) => { l(x, y); r(x + hw + 32, y); y += 92; };
  pair((cx, cy) => { headVal(ctx, cx, cy, hw, T('o.inc'), T('o.days', O.inc)); vSlider(ctx, P, 'oinc', cx + 14, cy + 34, hw - 28, O.inc, 1, 21, VC.amber, v => setOut('inc', v)); },
    (cx, cy) => { headVal(ctx, cx, cy, hw, T('o.inf'), T('o.days', O.inf)); vSlider(ctx, P, 'oinf', cx + 14, cy + 34, hw - 28, O.inf, 2, 30, VC.red, v => setOut('inf', v)); });
  if (y + 90 > bottom + 40) return;
  pair((cx, cy) => { head(ctx, cx, cy, T('o.spread')); flow(ctx, P, ['low', 'medium', 'high'].map(v => ({ id: 'sp:' + v, label: T('o.' + v), on: O.spread === v, fn: () => setOut('spread', v) })), cx, cy + 34, hw, cy + 34 + 52, { px: 21, h: 48 }); },
    (cx, cy) => { headVal(ctx, cx, cy, hw, T('o.cut'), `${O.cut} %`); vSlider(ctx, P, 'ocut', cx + 14, cy + 34, hw - 28, O.cut, 0, 90, VC.cyan, v => setOut('cut', v)); });
}
// the cell: a protein picked, its places and partners there, and the moves
function drawCellPane(ctx, P, x, y, W, bottom) {
  const A = api('cell'), f = protInfo(), mv = ctlVal('cell', 'move'), m = mv !== 'none' ? A.move(mv) : null;
  y += textBlock(ctx, T('c.sub'), x, y, W, 23, 31, VC.muted, 400, 3) + 12;
  const quick = QUICK_PROT.filter(sy => { const p = A.protein(sy); return Number.isInteger(p) && p >= 0; }).map(sy => A.info(A.protein(sy)).sym);
  y += flow(ctx, P, quick.map(sy => ({ id: 'pr:' + sy, label: sy, on: X.prot === sy, fn: () => selectProtein(X.prot === sy ? -1 : sy) })), x, y, W, bottom, { px: 22, h: 48 }) + 14;
  if (f) {
    y += textBlock(ctx, f.sym, x, y, W, 34, 42, VC.cyan, 700, 1);
    y += textBlock(ctx, (f.name !== f.sym ? f.name + ' · ' : '') + (f.role || ''), x, y, W, 22, 29, VC.muted, 400, 2) + 8;
    y += flow(ctx, P, f.places.map(pl => ({ id: 'pl:' + pl.k, label: pl.name, col: placeCol(pl.k) })), x, y, W, bottom, { px: 21, h: 44 }) + 10;
    for (const pp of f.partners.slice(0, 4)) {
      const t = pp.list.length ? pp.list.slice(0, 7).map(q => q.sym).join(', ') + (pp.list.length > 7 ? ' ' + T('c.more', pp.list.length - 7) : '') : T('c.alone');
      ctx.font = vfont(22, 700); ctx.fillStyle = placeCol(pp.place); const nm = pp.name + ': ', nw = Math.min(ctx.measureText(nm).width, W * 0.45);
      ctx.fillText(fitText(ctx, nm, W * 0.45), x, y);
      ctx.font = vfont(22); ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, t, W - nw - 4), x + nw + 4, y);
      y += 31;
    }
    y += 8;
  } else y += textBlock(ctx, T('c.none'), x, y, W, 23, 31, VC.faint, 400, 1) + 10;
  y += head(ctx, x, y, T('c.moves'));
  y += flow(ctx, P, [{ id: 'mv:none', label: T('c.nomove'), on: mv === 'none', fn: () => setMove('none') }]
    .concat(A.moves().map(q => ({ id: 'mv:' + q.key, label: q.name, col: q.disease ? VC.red : TEAL, on: mv === q.key, fn: () => setMove(mv === q.key ? 'none' : q.key) }))), x, y, W, bottom, { px: 21, h: 46 }) + 12;
  if (m && y + 80 < bottom) {
    y += textBlock(ctx, m.title, x, y, W, 26, 34, VC.ink, 700, 1) + 2;
    y += textBlock(ctx, m.text, x, y, W, 21, 28, VC.muted, 400, Math.max(1, Math.min(3, Math.floor((bottom - y - 60) / 28)))) + 8;
    for (const d of A.moveDelta(mv).filter(q => q.lost.length || q.gained.length).slice(0, 3)) {
      if (y + 30 > bottom) break;
      const syms = l => l.slice(0, 4).map(p => A.info(p).sym).join(', ');
      ctx.font = vfont(22, 700); ctx.fillStyle = d.lost.length ? VC.red : TEAL; ctx.fillText(d.sym, x, y); const sw2 = ctx.measureText(d.sym + '  ').width;
      ctx.font = vfont(21); ctx.fillStyle = VC.ink;
      ctx.fillText(fitText(ctx, [d.lost.length ? T('c.lost', syms(d.lost)) : '', d.gained.length ? T('c.gained', syms(d.gained)) : ''].filter(Boolean).join('; '), W - sw2), x + sw2, y + 1);
      y += 30;
    }
  }
}
// the three scenes, and the chosen scene's own controls
function drawScenesPane(ctx, P, x, y, W, bottom) {
  const cw = (W - 12 * (SCENES.length - 1)) / SCENES.length;
  SCENES.forEach(([k], j) => vButton(ctx, P, 'scene:' + k, x + j * (cw + 12), y, cw, 56, sceneName(k), () => openScene(k), { on: X.scene === k, px: 22 }));
  y += 76;
  y += textBlock(ctx, sceneDesc(X.scene), x, y, W, 25, 35, VC.muted, 400, 4) + 18;
  for (const c of ctlsOf(X.scene).filter(c => ctlShown(X.scene, c))) {
    if (y + 110 > bottom) break;
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(c.label, x, y);
    y += 36;
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlValue(X.scene, c) === v, fn: () => setCtl(X.scene, c.key, v) })), x, y, W, bottom, { px: 24, h: 56 }) + 24;
  }
}

// ----------------------------------------------------------- footer panel --
function sigFoot() {
  return APP.mode === 'story' ? 's' + LANG + Math.round(APP.t * 4) + APP.playing + (curCh ? curCh.key : '') + slideSig() : 'x' + LANG + X.turn + X.scene;
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
  // (the fish are life size round you: nothing to turn or zoom)
  if (X.scene === 'fish') return;
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(T('turn'), 28, 58);
  vButton(ctx, P, 'turn:on', 116, 40, 90, 56, T('on'), () => setTurn('on'), { on: X.turn === 'on', px: 22 });
  vButton(ctx, P, 'turn:off', 214, 40, 90, 56, T('off'), () => setTurn('off'), { on: X.turn === 'off', px: 22 });
  ctx.fillText(T('xr.zoom'), 340, 58);
  vButton(ctx, P, 'z-', 414, 40, 56, 56, '−', () => xrZoom(1.3), { px: 28 });
  vButton(ctx, P, 'z+', 476, 40, 56, 56, '+', () => xrZoom(1 / 1.3), { px: 28 });
  vButton(ctx, P, 'home', 570, 40, 260, 56, T('xr.whole'), () => flyTo(view(X.scene, 'default')), { px: 22 });
}


// ------------------------------------------------------------- narration --

// ================================================================ SCREENS ==
// The owner, 14 November 2026 (tools/studio/SPEC.md, "Screens: video and audio players"): "is it possible to have a
// video/audio player with playlist and an option to show controls even outside studio mode that can playback video or audio
// files from the relay"; in studio scenes, "shared per default, personal optional if easy".
// A screen (kind v, the state's v.<id>, layout.json's screens): a flat panel playing a playlist of the scene's video and
// sound files, its sound from where it stands (or, as an audio player, a small speaker), and a bar under it with the
// transport. One <video> element per screen per device; its picture a VideoTexture, its sound through the shell's context
// (createMediaElementSource into a gain and an HRTF panner, as a streamed sound's), its moment worked out from the record's
// play state { i, on, t, at } and the room's clock. The record's play is shared (a press writes it, no Undo step: it is not a
// change) or, with sync 'own', each device's own in memory. Undo never takes a press back (undoList keeps the current play).

const SCR_MAX = 50, SCR_VIDEOS = { page: 4, xr: 2 }, SCR_BAR_SHOW = 3000;
// the room's time (ms) at a station, else this device's clock; a function the tests replace, as trgClock
let screenClock = () => { try { if (atStation() && HOST.collab.now) return HOST.collab.now(); } catch (e) { /* not in a room */ } return Date.now(); };
const SCR = { dur: new Map(), drag: null, note: '', log: [] };   // (dur: the length of each file read here, by path; drag: the seek bar held on a page)
const scrKind = p => kindOf(p);

// ---------------------------------------------------------------- the record --
// { name, p, q, w, look, list, loop, shuffle, vol, r, sync, ctl, play, locked, shows } (the spec's "The record")
function normScreen(x, P, has, name, one) {
  const q = has('q') ? quatOf(x.q) : [0, 0, 0, 1];
  if (!q || !Array.isArray(x.list)) return null;
  const list = x.list.filter(f => okFile(f) && ['video', 'audio'].includes(scrKind(f))).slice(0, SCR_MAX);
  if (!list.length || (has('w') && !fin(x.w)) || (has('vol') && !fin(x.vol)) || (has('r') && !fin(x.r))) return null;
  const look = one('look', ['screen', 'audio'], 'screen');
  const r = { name: name(look === 'audio' ? 'Audio player' : 'Screen'), p: P, q, w: has('w') ? r2(clamp(x.w, 0.2, 20)) : 1.6, look, list, loop: one('loop', ['all', 'one', 'off'], 'all'),
    vol: has('vol') ? r2(clamp(x.vol, 0, 2)) : 1, r: has('r') ? r2(clamp(x.r, 0.1, 20)) : 3 };
  // (kept only when set: a shuffle's seed, who plays it, who may use the bar, and the shared play state)
  if (x.shuffle != null) r.shuffle = Number.isInteger(x.shuffle) && x.shuffle >= 1 && x.shuffle <= 2147483648 ? x.shuffle : null;
  if (x.sync != null) r.sync = x.sync === 'own' ? 'own' : null;
  if (x.ctl != null) r.ctl = x.ctl === 'any' ? 'any' : null;
  if (x.play != null) {
    const s = x.play;
    r.play = s && typeof s === 'object' && !Array.isArray(s) && Number.isInteger(s.i) && s.i >= 0 && typeof s.on === 'boolean' && fin(s.t) && s.t >= 0 && fin(s.at) && s.at >= 0
      ? { i: Math.min(s.i, list.length - 1), on: s.on, t: r3(s.t), at: Math.round(s.at) } : null;
  }
  return lockOf(x, showsOf(x, r));
}
// the order of the list: as listed, or a permutation seeded by the record's shuffle (mulberry32 and a Fisher-Yates: the same
// function on every device)
function shuffleOrder(n, seed) {
  const o = Array.from({ length: n }, (_, i) => i);
  if (!seed) return o;
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}
const scrOrder = r => shuffleOrder(r.list.length, r.shuffle || 0);
const scrPath = (r, i) => r.list[scrOrder(r)[clamp(i, 0, r.list.length - 1)]];
const scrOwn = it => it.rec.sync === 'own';

// ----------------------------------------------------------------- play state --
// the play state in force: the record's (shared; absent: paused at the first entry's start) or this device's own
function scrState(it) {
  const r = it.rec;
  if (scrOwn(it)) return it.own || (it.own = { i: 0, on: false, t: 0, at: Math.round(screenClock()) });
  const s = r.play;
  return s ? { i: Math.min(s.i, r.list.length - 1), on: s.on, t: s.t, at: s.at } : { i: 0, on: false, t: 0, at: 0 };
}
const scrT = (S, now) => Math.max(0, S.on ? S.t + (now - S.at) / 1000 : S.t);
// a new play state written: shared, into the record (no Undo step: not a change); own, in memory
function scrWrite(it, S) {
  S = { i: Math.max(0, S.i | 0), on: !!S.on, t: r3(Math.max(0, S.t)), at: Math.max(0, Math.round(S.at)) };
  if (scrOwn(it)) { it.own = S; return; }
  const was = it.rec.play;
  if (was && was.i === S.i && was.on === S.on && was.t === S.t && was.at === S.at) return;
  setRec(it.id, { play: S });
}
// the end of an entry: every device works out the next play state the same way from the same duration (the next entry from
// 0 at the moment the entry ended; 'one' the same again; the last: the first with 'all', else paused at its end), and writes it
function scrAdvance(it, now) {
  const r = it.rec, n = r.list.length;
  let S = scrState(it), moved = false;
  // (an entry whose file fails counts as ended: every device that sees the failure moves on from its first moment; one that
  // sees none gets the written state. A list where every entry fails stops after one round)
  const sv = it.sv;
  if (S.on && sv && sv.err && sv.errAt && sv.path === scrPath(r, S.i) && performance.now() - sv.errAt > 300) {
    it.errRun = (it.errRun || 0) + 1;
    if (it.errRun >= n || r.loop === 'one' || (S.i >= n - 1 && r.loop === 'off')) { it.errRun = 0; scrWrite(it, { i: S.i, on: false, t: 0, at: now }); }
    else scrWrite(it, { i: (S.i + 1) % n, on: true, t: 0, at: now });
    return;
  }
  for (let k = 0; k < 8 && S.on; k++) {
    // (a clip shorter than 0.2 s counts as 0.2 s here: at most five new play states a second from a list of tiny clips)
    const dur = Math.max(SCR.dur.get(scrPath(r, S.i)) || 0, SCR.dur.has(scrPath(r, S.i)) ? 0.2 : 0);
    if (!(dur > 0) || S.t + (now - S.at) / 1000 < dur) break;
    const at = Math.round(S.at + (dur - S.t) * 1000);
    moved = true;
    if (r.loop === 'one') S = { i: S.i, on: true, t: 0, at };
    else if (S.i < n - 1) S = { i: S.i + 1, on: true, t: 0, at };
    else if (r.loop === 'all') S = { i: 0, on: true, t: 0, at };
    else { S = { i: S.i, on: false, t: SCR.dur.get(scrPath(r, S.i)) || dur, at }; break; }
  }
  if (moved) scrWrite(it, S);
}
// who may use the bar and the card's transport: anyone editing, and anyone at all when its record says so (a visitor's kiosk
// too), unless the circle's story is locked
const scrCan = it => !!(it && it.kind === 'v' && STU.scene && (editOn() || (it.rec.ctl === 'any' && !editLocked())));
// a press of the transport (the bar, the card): the new play state; none is an Undo step
function scrPress(it, act, v) {
  if (!scrCan(it)) return false;
  const r = it.rec, n = r.list.length, now = Math.round(screenClock()), S = scrState(it), t = scrT(S, now);
  const dur = SCR.dur.get(scrPath(r, S.i)) || 0;
  let N = null;
  if (act === 'play') N = { i: S.i, on: !S.on, t: !S.on && dur && t >= dur - 0.05 ? 0 : t, at: now };
  else if (act === 'next') N = { i: (S.i + 1) % n, on: S.on, t: 0, at: now };
  else if (act === 'prev') N = t > 3 || n === 1 ? { i: S.i, on: S.on, t: 0, at: now } : { i: (S.i + n - 1) % n, on: S.on, t: 0, at: now };
  else if (act === 'seek') { if (dur > 0) N = { i: S.i, on: S.on, t: clamp(+v, 0, 1) * dur, at: now }; }
  else if (act === 'skip') N = { i: S.i, on: S.on, t: clamp(t + (+v || 0), 0, dur || 1e6), at: now };
  else if (act === 'go') N = { i: clamp(+v | 0, 0, n - 1), on: true, t: 0, at: now };
  else if (act === 'vol') {
    const cur = scrOwn(it) && it.ownVol != null ? it.ownVol : r.vol, nv = r2(clamp(Math.round((cur + (+v)) * 4) / 4, 0, 2));
    if (scrOwn(it)) it.ownVol = nv; else setRec(it.id, { vol: nv });   // (shared: the record's, no Undo step)
    scrSay(it, act);
    return true;
  }
  if (!N) return false;
  scrWrite(it, N);
  scrSay(it, act);
  return true;
}
function scrSay(it, act) {
  SCR.log.push([it.id, act, Math.round(performance.now())]); if (SCR.log.length > 40) SCR.log.shift();
  sfxAct('click', 'world', it.holder.getWorldPosition(new THREE.Vector3()).toArray());
}

// ----------------------------------------------------------------------- looks --
const SCR_PLANE = new THREE.PlaneGeometry(1, 1), SCR_EDGE = new THREE.EdgesGeometry(SCR_PLANE);
const SCR_COL = '#7fd2ff', SCR_BAR_H = 0.12;
const fmtT = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
// the bar's layout in design units (100 tall, as wide as its width asks: bw m at 0.12 m for 100 units)
function barLayout(Wd) {
  const wide = Wd >= 800, mw = wide ? 130 : 0;
  const mx0 = 184, mx1 = Wd - 106 - (wide ? mw + 4 : 0), sx0 = mx0 + 126, sx1 = mx1 - 8;
  return { Wd, wide, mw, mx0, mx1, sx0, sx1, R: [
    { k: 'prev', x0: 6, x1: 56, y0: 10, y1: 90 }, { k: 'play', x0: 60, x1: 118, y0: 10, y1: 90 }, { k: 'next', x0: 122, x1: 172, y0: 10, y1: 90 },
    { k: 'seek', x0: sx0 - 6, x1: sx1 + 6, y0: 44, y1: 98 },
    { k: 'vdn', x0: Wd - 102, x1: Wd - 54, y0: 10, y1: 90 }, { k: 'vup', x0: Wd - 50, x1: Wd - 6, y0: 10, y1: 90 },
  ] };
}
// the seek bar's width in design units asks for a bar of at least 0.6 m and at most 2.4 m
const scrBarW = r => clamp(r.look === 'audio' ? 0.9 : r.w, 0.6, 2.4);
function screenLook(id) {
  const body = new THREE.Group(), deco = new THREE.Group(), col = LOOKS.colOf(id);
  // (the panel: a unit plane, its height set from the video's shape each frame; a card of its own while no picture is drawn)
  const cardCv = document.createElement('canvas'); cardCv.width = 640; cardCv.height = 360;
  const cardTex = new THREE.CanvasTexture(cardCv); cardTex.minFilter = THREE.LinearFilter; cardTex.generateMipmaps = false;
  const mat = new THREE.MeshBasicMaterial({ map: cardTex, toneMapped: false });
  const panel = new THREE.Mesh(SCR_PLANE, mat);
  const back = new THREE.Mesh(SCR_PLANE, new THREE.MeshBasicMaterial({ color: 0x0c1118 })); back.rotation.y = Math.PI; back.position.z = -0.003;
  const hit = new THREE.Mesh(SCR_PLANE, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
  const line = LOOKS.batched(new THREE.LineSegments(SCR_EDGE, new THREE.LineBasicMaterial({ color: 0xffffff })), 'line'); line.renderOrder = 6; line.visible = false;
  body.add(panel, back, hit, line);
  const name = LOOKS.tag(30); deco.add(name);
  // (the bar: apart in the items' frame, so the holder's scale (the width) never stretches it; opaque, depth-tested)
  const barCv = document.createElement('canvas'); barCv.width = 64; barCv.height = 64;
  const barTex = new THREE.CanvasTexture(barCv); barTex.minFilter = THREE.LinearFilter; barTex.generateMipmaps = false;
  const bar = new THREE.Mesh(SCR_PLANE, new THREE.MeshBasicMaterial({ map: barTex, toneMapped: false })); bar.visible = false; bar.userData.bar = true;
  const L = { body, deco, name, panel, back, hit, line, bar, barCv, barTex, cardCv, cardTex, mat, col, ext: [1.6, 0.9], barSig: '', cardSig: '', transp: false, lastA: -1,
    // hot: the pointer on it, selected, editing, hid: a cube hides it from you (not drawn: its edges show where it is while editing)
    look(o) {
      line.visible = !!o.editing && (o.hid || o.hot || o.selected);
      line.material.color.set(col).lerp(new THREE.Color(1, 1, 1), o.selected || o.hot ? 0.6 : 0.1);
      panel.visible = back.visible = !o.hid && o.a > 0.002;
      name.visible = !!o.editing && !(o.hot || o.selected);
      if (Math.abs(o.a - L.lastA) > 1e-3) {
        L.lastA = o.a;
        const tr = o.a < 0.999;
        mat.opacity = o.a; back.material.opacity = o.a;
        if (tr !== L.transp) { L.transp = tr; mat.transparent = back.material.transparent = tr; mat.depthWrite = back.material.depthWrite = !tr; mat.needsUpdate = back.material.needsUpdate = true; }
      }
    },
    drop() {
      for (const m of [mat, back.material, hit.material, line.material, bar.material]) m.dispose();
      cardTex.dispose(); barTex.dispose(); name.userData.drop();
      if (bar.parent) bar.parent.remove(bar);
    },
  };
  return L;
}

// ------------------------------------------------------- the player (per device) --
// a record taken (applyRec): its look and name, the playlist's order; its element rebuilt when its file changes (screensStep)
function screenRec(it, was) {
  const r = it.rec, L = it.look;
  L.name.userData.set(tagName(r) + (r.look === 'audio' ? ' · audio player' : ` · ${r.list.length} entr${r.list.length === 1 ? 'y' : 'ies'}`), L.col, 0.075);
  L.barSig = ''; L.cardSig = '';
  if (!was || was.look !== r.look) L.hit.scale.set(1, 1, 1);
}
function screenDrop(it) {
  svDrop(it);
  SCR.dur.size > 400 && SCR.dur.clear();
}
function svDrop(it) {
  if (it.svOld) { svDropOf(it, it.svOld); it.svOld = null; }
  const sv = it.sv;
  if (!sv) return;
  it.sv = null;
  svDropOf(it, sv);
}
function svDropOf(it, sv) {
  try { sv.el.pause(); } catch (e) { /* gone */ }
  for (const n of [sv.node, sv.gain, sv.pan]) try { n && n.disconnect(); } catch (e) { /* gone */ }
  try { sv.el.removeAttribute('src'); sv.el.load(); } catch (e) { /* gone */ }
  if (sv.tex) sv.tex.dispose();
  if (it.look && it.look.mat.map === sv.tex) { it.look.mat.map = it.look.cardTex; it.look.mat.needsUpdate = true; }
}
function screensDispose() {
  for (const it of STU.items.values()) if (it.kind === 'v') svDrop(it);
  // (the listener back at the origin, as the emitters do: with screens and no emitters nothing else would)
  if (SCR.lisCtx) { try { listen(SCR.lisCtx, new THREE.Vector3(), new THREE.Quaternion()); } catch (e) { /* closed */ } SCR.lisCtx = null; }
}
// its element (made once per context: an element feeds one context only; before there is a context it plays muted)
function svMake(it, ctx) {
  const el = document.createElement('video');
  el.playsInline = true; el.setAttribute('playsinline', ''); el.crossOrigin = 'anonymous'; el.preload = 'auto'; el.muted = !ctx; el.loop = false;
  const sv = it.sv = { el, ctx: null, path: '', url: '', tex: new THREE.VideoTexture(el), need: true, playAt: 0, chk: 0, fixAt: 0, lag: 0.05, drift: 0, fixes: 0, err: '', drawn: false, over: false };
  svConnect(it, sv, ctx);
  const dur = () => { if (sv.path && isFinite(el.duration) && el.duration > 0) SCR.dur.set(sv.path, el.duration); };
  el.addEventListener('loadedmetadata', dur); el.addEventListener('durationchange', dur);
  el.addEventListener('playing', () => { sv.playAt = performance.now(); it.errRun = 0; });
  el.addEventListener('error', () => { sv.err = 'Could not play this file'; sv.errAt = performance.now(); if (SRC.linkTtl > 0 && linksAge() > 60000) linksFresh(); });
  return sv;
}
// the element's sound onto a context (an element feeds one context only, once: so a context that comes to an element that
// has none is joined in place, and only a different one afterwards means a new element)
function svConnect(it, sv, ctx) {
  if (!ctx || sv.ctx || sv.noCtx) return;
  try {
    sv.node = ctx.createMediaElementSource(sv.el); sv.gain = ctx.createGain(); sv.pan = ctx.createPanner();
    sv.gain.gain.value = 0; sv.gt = 0;
    sv.pan.panningModel = 'HRTF'; sv.pan.distanceModel = 'inverse'; sv.pan.refDistance = it.rec.r; sv.pan.rolloffFactor = 1; sv.pan.maxDistance = 50;
    sv.node.connect(sv.gain); sv.gain.connect(sv.pan); sv.pan.connect(ctx.destination);
    sv.ctx = ctx;
  } catch (e) { sv.ctx = null; sv.noCtx = true; sv.el.muted = true; }
}
const _srp = new THREE.Vector3(), _srq = new THREE.Quaternion(), _srf = new THREE.Vector3(), _sru = new THREE.Vector3();
// every frame: which screens may play (shown, in explore mode, the nearest few), each one's element, picture, sound and bar
function screensStep(editing, now, dt) {
  const A = HOST.audio, ctx = A && A.fx ? A.fx() : null, wall = Math.round(screenClock()), headset = !!(XR.on && GL.renderer.xr.isPresenting);
  const list = [];
  for (const it of STU.items.values()) if (it.kind === 'v') list.push(it);
  if (!list.length) return;
  // (where the viewer is, for the nearest first and the listener)
  if (headset) _srp.copy(XR.head); else GL.camera.getWorldPosition(_srp);
  const quiet = !!(A && A.muted) || APP.mode !== 'explore' || sfxHidden() || !STU.scene;
  // who may play now: shown for you, in explore mode, the studio on show; of those playing, the nearest (2 in a headset, 4 on a page)
  const can = list.filter(it => it.shown && !it.notHere && APP.mode === 'explore' && STU.scene && !sfxHidden() && !document.hidden);
  for (const it of can) scrAdvance(it, wall);
  const playing = can.filter(it => scrState(it).on).map(it => ({ it, d: it.holder.getWorldPosition(_srf).distanceTo(_srp) })).sort((a, b) => a.d - b.d);
  const lim = headset ? SCR_VIDEOS.xr : SCR_VIDEOS.page, ok = new Set(playing.slice(0, lim).map(x => x.it)), over = new Set(playing.slice(lim).map(x => x.it));
  let any = false;
  for (const it of list) {
    const L = it.look, r = it.rec, S = scrState(it), audio = r.look === 'audio';
    it.fa = it.sa;
    // the pose of the panel (its height from the video's shape) and where the bar, the tag and the edges stand
    const sv0 = it.sv, asp = !audio && sv0 && sv0.drawn && sv0.el.videoHeight ? sv0.el.videoWidth / sv0.el.videoHeight : 16 / 9;
    const pw = audio ? 0.3 : r.w, ph = audio ? 0.3 : r.w / asp, s = audio ? 0.3 / r.w : 1;
    L.ext[0] = pw; L.ext[1] = ph;
    for (const m of [L.panel, L.back, L.hit, L.line]) m.scale.set(s, audio ? s : s / asp, 1);
    it.holder.visible = it.a > 0.002 || editing;
    L.look({ a: it.a, hid: it.hid, editing, hot: editing && STU.hover === it.id, selected: editing && STU.sel === it.id });
    L.deco.visible = editing && it.holder.visible;
    if (L.deco.visible) { L.deco.position.copy(it.holder.position); L.deco.quaternion.copy(it.holder.quaternion); L.name.position.set(0, ph / 2 + 0.05, 0); }
    // its element: wanted while allowed to play (or paused showing its picture), dropped on a new context
    const allowed = can.includes(it) && !over.has(it);
    it.over = over.has(it);
    const path = scrPath(r, S.i), url = fileUrl(path, true);
    let sv = it.sv;
    // (a context that goes null (Sound off, hidden, renewing) keeps the element, silent; one that comes joins an element that has
    // none; only a different one than the element's own means a new element, the old picture kept until the new one has a frame)
    if (sv && ctx && !sv.ctx) svConnect(it, sv, ctx);
    if (sv && ctx && sv.ctx && sv.ctx !== ctx && allowed) {
      const old = sv; old.stale = true;
      try { old.el.pause(); } catch (e) { /* gone */ }
      for (const n of [old.node, old.gain, old.pan]) try { n && n.disconnect(); } catch (e) { /* gone */ }
      if (it.svOld) svDropOf(it, it.svOld);
      it.svOld = old; it.sv = null; sv = null;
    }
    if (!sv && allowed && STU.fileMap.has(path)) { sv = svMake(it, ctx); }
    if (it.svOld && (!allowed || (sv && sv.drawn) || !it.svOld.drawn)) { svDropOf(it, it.svOld); it.svOld = null; }
    if (sv) {
      const el = sv.el;
      sv.over = it.over;
      if (!allowed) {
        // (hidden, over the limit, not in explore mode: paused and silent; its play state goes on, and it is set to its moment when allowed again)
        if (!el.paused) { try { el.pause(); } catch (e) { /* gone */ } }
        sv.paused = true; sv.need = true; sv.playAt = 0;
        if (sv.ctx && sv.gt !== 0) { try { sv.gain.gain.setTargetAtTime(0, sv.ctx.currentTime, 0.05); } catch (e) { /* closed */ } sv.gt = 0; }
      }
      else {
        sv.paused = false;
        if (sv.path !== path || sv.url !== url) {
          // (a new entry, or R2's link read again: the element points at it; its time set once its metadata is in)
          if (sv.path !== path) { sv.drawn = false; sv.err = ''; }
          sv.need = true;   // (a new link for the same file too: its moment is set again once its metadata is in)
          sv.path = path; sv.url = url; el.src = url; sv.errAt = 0;
          try { el.load(); } catch (e) { /* not now */ }
        }
        if (sv.err && sv.errAt && performance.now() - sv.errAt > 2000 && !S.on) { sv.err = ''; }
        const t = scrT(S, wall), dur = SCR.dur.get(path) || (isFinite(el.duration) ? el.duration : 0), ended = dur > 0 && t >= dur - 0.02;
        const target = ended ? dur : t, thr = headset ? 0.35 : 0.25;
        if (el.readyState >= 1 && sv.need) { try { el.currentTime = Math.min(target + (S.on ? sv.lag : 0), dur || 1e9); } catch (e) { /* not seekable yet */ } sv.need = false; }
        if (S.on && !ended && !sv.err) {
          if (el.paused) { const pr = el.play(); if (pr && pr.catch) pr.catch(() => { /* not allowed yet: again next frame */ }); }
          if (el.readyState >= 3 && !el.seeking && sv.playAt && performance.now() - sv.playAt > 150 && performance.now() - sv.chk > 500) {
            sv.chk = performance.now();
            const d = sv.drift = t - el.currentTime;
            if (Math.abs(d) > thr) {
              if (sv.fixAt && performance.now() - sv.fixAt < 3000) sv.lag = clamp(sv.lag + d, 0, 0.5);
              sv.fixAt = performance.now(); sv.fixes++;
              try { el.currentTime = Math.max(0, t + sv.lag); } catch (e) { /* not seekable now */ }
            }
          }
        } else {
          if (!el.paused) { try { el.pause(); } catch (e) { /* gone */ } }
          if (el.readyState >= 1 && !el.seeking && Math.abs(el.currentTime - target) > 0.08) { try { el.currentTime = target; } catch (e) { /* not seekable */ } }
        }
        // its sound: through the shell's context only, following the Sound button; before a tap the element is muted
        sv.drawn = !audio && !sv.over && el.readyState >= 2 && el.videoWidth > 0;
        if (sv.ctx && sv.ctx === ctx) {
          el.muted = false;
          const vol = scrOwn(it) && it.ownVol != null ? it.ownVol : r.vol, want = quiet || !S.on || ended ? 0 : it.fa * vol;
          if (sv.gt !== want) { try { sv.gain.gain.setTargetAtTime(want, sv.ctx.currentTime, 0.1); } catch (e) { /* closed */ } sv.gt = want; }
          it.holder.getWorldPosition(_srf); setPos(sv.pan, _srf);
          if (sv.pan.refDistance !== r.r) sv.pan.refDistance = r.r;
          if (want > 0) any = true;
        } else { el.muted = true; if (sv.ctx && sv.gt !== 0) { try { sv.gain.gain.value = 0; } catch (e) { /* closed */ } sv.gt = 0; } }   // (no context now: silent, the element kept)
      }
      if (sv.drawn && L.mat.map !== sv.tex) { L.mat.map = sv.tex; L.mat.needsUpdate = true; }
      else if (!sv.drawn && it.svOld && it.svOld.drawn) { if (L.mat.map !== it.svOld.tex) { L.mat.map = it.svOld.tex; L.mat.needsUpdate = true; } }
      else if (!sv.drawn && L.mat.map !== L.cardTex) { L.mat.map = L.cardTex; L.mat.needsUpdate = true; }
    } else if (it.svOld && it.svOld.drawn) { if (L.mat.map !== it.svOld.tex) { L.mat.map = it.svOld.tex; L.mat.needsUpdate = true; } }
    else if (L.mat.map !== L.cardTex) { L.mat.map = L.cardTex; L.mat.needsUpdate = true; }
    scrCard(it, S, path);
    scrBar(it, S, path, editing, now, ph, pw);
  }
  // the listener (the same as the emitters': a head in a headset, the camera on a page)
  if (any && ctx) {
    if (headset) { _srp.copy(XR.head); _srq.copy(XR.headQ); } else { GL.camera.getWorldPosition(_srp); GL.camera.getWorldQuaternion(_srq); }
    listen(ctx, _srp, _srq);
    EM.lis = true; SCR.lisCtx = ctx;
  }
}
// the card that stands in for the picture (loading, a sound, paused before any frame, too many playing, a file that fails)
function scrCard(it, S, path) {
  const L = it.look, sv = it.sv;
  if (L.mat.map !== L.cardTex) return;
  const st = it.over ? 'Too many videos playing here' : sv && sv.err ? sv.err : !STU.fileMap.has(path) ? 'This file is not in the scene' : !sv ? (S.on ? 'Starting...' : 'Paused')
    : scrKind(path) === 'audio' && sv.el.readyState >= 1 ? (S.on ? 'Playing' : 'Paused') : sv.el.readyState < 2 ? 'Loading...' : S.on ? 'Playing' : 'Paused';
  const sig = it.rec.name + '|' + baseName(path) + '|' + st + '|' + it.rec.look;
  if (sig === L.cardSig) return;
  L.cardSig = sig;
  const c = L.cardCv, x = c.getContext('2d'), W = c.width, H = c.height;
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1b2740'); g.addColorStop(1, '#0a101c');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = L.col; x.fillRect(0, 0, 8, H);
  x.textBaseline = 'middle'; x.textAlign = 'left';
  x.font = '700 40px B612, "Segoe UI", Arial, sans-serif'; x.fillStyle = '#f2f6fc';
  x.fillText(clip(x, it.rec.name, W - 90), 44, H * 0.34);
  x.font = '600 28px B612, "Segoe UI", Arial, sans-serif'; x.fillStyle = '#b8c6dc';
  x.fillText(clip(x, baseName(path), W - 90), 44, H * 0.52);
  x.fillStyle = L.col; x.fillText(st, 44, H * 0.72);
  L.cardTex.needsUpdate = true;
}
function clip(x, text, w) {
  if (x.measureText(text).width <= w) return text;
  while (text.length > 1 && x.measureText(text + '...').width > w) text = text.slice(0, -1);
  return text + '...';
}
// the bar: where it stands (under the panel, over the speaker), whether it shows, and its picture, drawn again only when
// what it shows changes (its time at most twice a second)
function scrBar(it, S, path, editing, now, ph, pw) {
  const L = it.look, r = it.rec, bar = L.bar;
  const vis = scrCan(it) && it.holder.visible && it.a > 0.5 && !it.hid && ((editing && STU.sel === it.id) || now - (it.hotAt || 0) < SCR_BAR_SHOW);
  bar.visible = vis;
  if (!vis) return;
  const bw = scrBarW(r), audio = r.look === 'audio';
  _sru.set(0, audio ? ph / 2 + 0.03 + SCR_BAR_H / 2 : -(ph / 2 + 0.03 + SCR_BAR_H / 2), 0.006).applyQuaternion(it.holder.quaternion).add(it.holder.position);
  bar.position.copy(_sru); bar.quaternion.copy(it.holder.quaternion); bar.scale.set(bw, SCR_BAR_H, 1);
  const wall = Math.round(screenClock()), t = scrT(S, wall), dur = SCR.dur.get(path) || 0, n = r.list.length, vol = scrOwn(it) && it.ownVol != null ? it.ownVol : r.vol;
  const lay = barLayout(bw / SCR_BAR_H * 100), frac = dur > 0 ? clamp(t / dur, 0, 1) : 0;
  const sig = [S.on, S.i, baseName(path), Math.floor(Math.min(t, dur || 1e9) * 2), Math.round(frac * 400), vol, scrOwn(it), n, dur > 0, Math.round(lay.Wd)].join('|');
  if (sig === L.barSig) return;
  L.barSig = sig;
  const K = Math.min(2, 2048 / lay.Wd), W = Math.round(lay.Wd * K), H = Math.round(100 * K), c = L.barCv;
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  const x = c.getContext('2d');
  x.setTransform(K, 0, 0, K, 0, 0);
  x.clearRect(0, 0, lay.Wd, 100);
  x.fillStyle = '#0d1522'; x.fillRect(0, 0, lay.Wd, 100);
  x.fillStyle = L.col; x.fillRect(0, 0, lay.Wd, 4);
  const btn = k => { const R = lay.R.find(q => q.k === k); x.fillStyle = '#1d2c44'; rr(x, R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0, 10); x.fill(); return R; };
  const ic = '#e9f1fc';
  { const R = btn('prev'), cx = (R.x0 + R.x1) / 2; x.fillStyle = ic; x.fillRect(cx - 14, 36, 4, 28); x.beginPath(); x.moveTo(cx + 14, 36); x.lineTo(cx + 14, 64); x.lineTo(cx - 8, 50); x.closePath(); x.fill(); }
  { const R = btn('play'), cx = (R.x0 + R.x1) / 2; x.fillStyle = ic; if (S.on) { x.fillRect(cx - 12, 34, 8, 32); x.fillRect(cx + 4, 34, 8, 32); } else { x.beginPath(); x.moveTo(cx - 10, 33); x.lineTo(cx - 10, 67); x.lineTo(cx + 14, 50); x.closePath(); x.fill(); } }
  { const R = btn('next'), cx = (R.x0 + R.x1) / 2; x.fillStyle = ic; x.fillRect(cx + 10, 36, 4, 28); x.beginPath(); x.moveTo(cx - 14, 36); x.lineTo(cx - 14, 64); x.lineTo(cx + 8, 50); x.closePath(); x.fill(); }
  x.textBaseline = 'middle';
  x.font = '600 22px B612, "Segoe UI", Arial, sans-serif'; x.fillStyle = '#f2f6fc'; x.textAlign = 'left';
  const right = `${S.i + 1} of ${n}` + (lay.wide ? '' : scrOwn(it) ? ' · Just you' : ' · Everyone');
  x.textAlign = 'right'; x.fillStyle = '#9fb0c4'; x.fillText(right, lay.mx1, 24);
  const rw = x.measureText(right).width + 16;
  x.textAlign = 'left'; x.fillStyle = '#f2f6fc'; x.fillText(clip(x, baseName(path), lay.mx1 - lay.mx0 - rw), lay.mx0, 24);
  x.font = '600 20px B612, "Segoe UI", Arial, sans-serif'; x.fillStyle = '#c8d6ea';
  x.fillText(dur > 0 ? `${fmtT(t)} / ${fmtT(dur)}` : fmtT(t), lay.mx0, 66);
  x.fillStyle = '#26364f'; rr(x, lay.sx0, 60, lay.sx1 - lay.sx0, 12, 6); x.fill();
  x.fillStyle = L.col; rr(x, lay.sx0, 60, Math.max(12, (lay.sx1 - lay.sx0) * frac), 12, 6); x.fill();
  x.beginPath(); x.arc(lay.sx0 + (lay.sx1 - lay.sx0) * frac, 66, 10, 0, 7); x.fillStyle = '#ffffff'; x.fill();
  for (const k of ['vdn', 'vup']) { const R = btn(k); x.fillStyle = ic; const cx = (R.x0 + R.x1) / 2; x.fillRect(cx - 10, 48, 20, 4); if (k === 'vup') x.fillRect(cx - 2, 40, 4, 20); }
  if (lay.wide) {
    x.textAlign = 'left'; x.font = '600 20px B612, "Segoe UI", Arial, sans-serif'; x.fillStyle = '#9fb0c4';
    x.fillText(scrOwn(it) ? 'Just you' : 'Everyone', lay.mx1 + 12, 34); x.fillText(`Vol ${Math.round(vol * 100)} %`, lay.mx1 + 12, 66);
  } else { x.textAlign = 'right'; x.fillStyle = '#9fb0c4'; x.font = '600 16px B612, "Segoe UI", Arial, sans-serif'; x.fillText(`${Math.round(vol * 100)} %`, lay.Wd - 108, 50); }
  L.barTex.needsUpdate = true;
}

// ------------------------------------------------------- the bar: rays and presses --
// the bar's region under a hit on it (its uv), and for the seek bar where along it (0 to 1)
function barRegion(it, uv) {
  const lay = barLayout(scrBarW(it.rec) / SCR_BAR_H * 100), x = uv.x * lay.Wd, y = (1 - uv.y) * 100;
  const R = lay.R.find(q => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1);
  if (!R) return null;
  return { key: R.k, frac: R.k === 'seek' ? clamp((x - lay.sx0) / (lay.sx1 - lay.sx0), 0, 1) : 0 };
}
// the nearest bar a ray meets (one that is shown, and its screen's bar usable), the panels it points at lighting their bars for
// 3 s (a ray or the page's pointer on the screen or the bar); the bar is pressed instead of selecting its screen, except
// while editing with the screen not selected
function screenRay(rc, now) {
  let best = null;
  for (const it of STU.items.values()) {
    if (it.kind !== 'v' || !it.holder.visible || !it.shown || it.notHere || it.hid) continue;
    const L = it.look;
    it.holder.updateWorldMatrix(true, false); L.hit.updateWorldMatrix(true, false);
    if (rc.intersectObject(L.hit, false).length) it.hotAt = now;
    if (!L.bar.visible || !scrCan(it) || (editOn() && STU.sel !== it.id)) continue;
    L.bar.updateWorldMatrix(true, false);
    const h = rc.intersectObject(L.bar, false)[0], g = h && h.uv ? barRegion(it, h.uv) : null;
    if (h) it.hotAt = now;
    if (g && (!best || h.distance < best.dist)) best = { id: it.id, key: g.key, frac: g.frac, point: h.point.clone(), dist: h.distance };
  }
  return best;
}
// a press on a bar's region (the headset's trigger, a page's click)
function screenBarPress(id, key, frac) {
  const it = STU.items.get(id);
  if (!it || !scrCan(it)) return false;
  if (key === 'seek') return scrPress(it, 'seek', frac);
  const act = { prev: 'prev', play: 'play', next: 'next', vup: 'vol', vdn: 'vol' }[key];
  return !!act && scrPress(it, act, key === 'vup' ? 0.25 : key === 'vdn' ? -0.25 : 0);
}
// the page: the pointer down on a bar presses it (the seek bar then follows the drag); on a panel it only lights its bar
function screenDown(ev) {
  if (APP.mode !== 'explore' || XR.on || ev.button > 0) return false;
  const h = screenRay(pointerRay(ev.clientX, ev.clientY), performance.now());
  if (!h) return false;
  screenBarPress(h.id, h.key, h.frac);
  if (h.key === 'seek') SCR.drag = { id: h.id, pid: ev.pointerId, at: performance.now(), pend: null };
  return true;
}
function screenDragTo(ev) {
  const D = SCR.drag, it = D && STU.items.get(D.id);
  if (!it) { SCR.drag = null; return; }
  const rc = pointerRay(ev.clientX, ev.clientY);
  it.look.bar.updateWorldMatrix(true, false);
  const h = rc.intersectObject(it.look.bar, false)[0], g = h && h.uv ? barRegion(it, h.uv) : null;
  if (!g || g.key !== 'seek') return;
  // (the shared play state is written at most every 200 ms while dragging, and once more as the pointer is let go)
  const t = performance.now();
  if (t - D.at >= 200) { D.at = t; D.pend = null; scrPress(it, 'seek', g.frac); } else D.pend = g.frac;
}
function screenDragEnd() {
  const D = SCR.drag, it = D && STU.items.get(D.id);
  SCR.drag = null;
  if (it && D.pend != null) scrPress(it, 'seek', D.pend);
}
// the pointer moving over the page: the screen or bar under it lights its bar; the cursor says a bar can be pressed
function screenHover(ev, cv) {
  if (APP.mode !== 'explore' || XR.on || ev.pointerType === 'touch') return;
  const h = screenRay(pointerRay(ev.clientX, ev.clientY), performance.now());
  if (h) cv.style.cursor = 'pointer';
}

// ---------------------------------------------------------------------- adding --
const _srb = new THREE.Box3(), _srv = new THREE.Vector3(), _srm = new THREE.Matrix4(), _sro = new THREE.Vector3(1, 1, 1);
// its box in the items' frame (the panel's corners, with the bar's room left out)
function screenBox(it, out) {
  const [w, h] = it.look.ext;
  _srm.compose(it.holder.position, it.holder.quaternion, _sro);
  out.makeEmpty();
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out.expandByPoint(_srv.set(a * w / 2, b * h / 2, 0).applyMatrix4(_srm));
  return out;
}
function scrFirst() {
  const fs = STU.files.filter(f => !inOriginals(f.path));
  const v = fs.find(f => f.kind === 'video' || scrKind(f.path) === 'video'), a = fs.find(f => f.kind === 'audio' || scrKind(f.path) === 'audio');
  return v || a;   // (the same for both: the first video, else the first sound)
}
// a screen (or an audio player) 1.5 m in front of you, its panel's middle 1.6 m up, facing you; its playlist starting with the
// file given, else the scene's first video, else its first sound
function addScreen(look, path) {
  if (!canAdd('v')) return '';
  const first = path ? { path } : scrFirst();
  if (!first) { SCR.note = 'Put a video or sound into the scene first (under Upload).'; dirty(true); return ''; }
  SCR.note = '';
  const at = frontAt(), id = newId(), c = _srv;
  if (XR.on && GL.renderer.xr.isPresenting) { GL.world.updateMatrixWorld(true); GL.world.worldToLocal(c.copy(XR.head)); } else { GL.world.updateMatrixWorld(true); GL.world.worldToLocal(GL.camera.getWorldPosition(c)); }
  const yaw = Math.atan2(c.x - at[0], c.z - at[1]), q = new THREE.Quaternion().setFromAxisAngle(_yUp, yaw).toArray();
  change(() => putItem(id, 'v', norm('v', { name: nameFor(look === 'audio' ? 'Audio player' : stem(first.path)), look: look === 'audio' ? 'audio' : 'screen', p: [at[0], look === 'audio' ? 1.2 : 1.6, at[1]], q, list: [first.path] })));
  if (!STU.items.has(id)) return '';
  select(id);
  sfxAct('place', 'world', null);
  return id;
}

// ------------------------------------------------------------------ edits (the card) --
// each a change (one Undo step): edits of the record; the transport's presses are not (scrPress)
const scrSet = (it, patch) => { if (it.kind === 'v') setRec(it.id, patch); };
const WIDTHS = [0.5, 2];
Object.assign(ITEM_ACT, {
  scLook: (it, v) => { if (v === 'screen' || v === 'audio') scrSet(it, { look: v }); },
  scWidth: (it, v) => { if (WIDTHS.includes(+v)) scrSet(it, { w: clamp(it.rec.w * +v, 0.2, 20) }); },
  scWidthD: (it, d) => scrSet(it, { w: clamp(it.rec.w + (+d || 0), 0.2, 20) }),
  scLoop: (it, v) => { if (['all', 'one', 'off'].includes(v)) scrSet(it, { loop: v }); },
  // shuffle on picks a new seed (the playing entry stays the one playing: its place in the new order)
  scShuffle: (it, v) => {
    const r = it.rec, on = v === 'on';
    if (on === !!r.shuffle) return;
    const S = scrState(it), idx = scrOrder(r)[S.i], seed = on ? 1 + Math.floor(Math.random() * 2147483646) : undefined, o = shuffleOrder(r.list.length, seed || 0);
    scrSet(it, { shuffle: seed });
    scrWrite(it, Object.assign({}, S, { i: Math.max(0, o.indexOf(idx)) }));
  },
  scVol: (it, d) => scrSet(it, { vol: r2(clamp(Math.round((it.rec.vol + (+d)) * 4) / 4, 0, 2)) }),
  scReach: (it, d) => { const S = [0.25, 0.5, 1, 1.5, 2, 3, 5, 8, 12, 20], i = S.findIndex(x => x >= it.rec.r - 1e-6); scrSet(it, { r: S[clamp((i < 0 ? S.length - 1 : i) + (+d), 0, S.length - 1)] }); },
  scSync: (it, v) => {
    const own = v === 'own';
    if (own === scrOwn(it)) return;
    if (own) { const S = scrState(it); it.own = { i: S.i, on: S.on, t: S.t, at: S.at }; scrSet(it, { sync: 'own' }); }
    else { const S = scrState(it), now = Math.round(screenClock()); scrSet(it, { sync: undefined, play: { i: S.i, on: false, t: r3(scrT(S, now)), at: now } }); it.own = null; }   // (back to shared: a fresh paused state, never a stale one)
  },
  scCtl: (it, v) => scrSet(it, { ctl: v === 'any' ? 'any' : undefined }),
  scAdd: (it, p) => { if (it.kind === 'v' && STU.fileMap.has(p) && it.rec.list.length < SCR_MAX && ['video', 'audio'].includes(scrKind(p))) scrSet(it, { list: it.rec.list.concat(p) }); },
  scDel: (it, i) => {
    const r = it.rec, k = +i;
    if (it.kind !== 'v' || r.list.length < 2 || !(k >= 0 && k < r.list.length)) return;
    const S = scrState(it), ord = scrOrder(r), playing = ord[S.i], list = r.list.filter((_, j) => j !== k);
    // (the entry playing keeps playing unless it is the one taken out: then the next one, from its start)
    const idx = playing === k ? Math.min(k, list.length - 1) : playing > k ? playing - 1 : playing, o = shuffleOrder(list.length, r.shuffle || 0);
    scrSet(it, { list });
    scrWrite(it, { i: Math.max(0, o.indexOf(idx)), on: S.on, t: playing === k ? 0 : scrT(S, Math.round(screenClock())), at: Math.round(screenClock()) });
  },
  scMove: (it, v) => {
    const [i, d] = String(v).split(':').map(Number), r = it.rec, j = i + d;
    if (it.kind !== 'v' || !(i >= 0 && i < r.list.length && j >= 0 && j < r.list.length)) return;
    const S = scrState(it), playing = scrOrder(r)[S.i], list = r.list.slice();
    [list[i], list[j]] = [list[j], list[i]];
    const idx = playing === i ? j : playing === j ? i : playing, o = shuffleOrder(list.length, r.shuffle || 0);
    scrSet(it, { list });
    scrWrite(it, Object.assign({}, S, { i: Math.max(0, o.indexOf(idx)) }));
  },
  scAddOpen: it => { SCR.adding = SCR.adding === it.id ? '' : it.id; SCR.addPage = 0; },
  scAddPage: (it, d) => { SCR.addPage = Math.max(0, (SCR.addPage || 0) + (+d || 0)); },
  scListPage: (it, d) => { SCR.listPage = Math.max(0, (SCR.listPage || 0) + (+d || 0)); },
});
PANE_ONLY.push('scAddOpen', 'scAddPage', 'scListPage');
// the transport on the card and its other presses without an Undo step (not editing too, with Who can use the controls: Anyone)
const SCR_ACT = {
  scPlay: () => scrCard1('play'), scPrev: () => scrCard1('prev'), scNext: () => scrCard1('next'),
  scSkip: v => scrCard1('skip', v), scGo: v => scrCard1('go', v), scBarVol: v => scrCard1('vol', v),
};
function scrCard1(act, v) { const it = STU.items.get(STU.sel); if (it && it.kind === 'v') scrPress(it, act, v); }
// the screen's card (page and headset), in the editing's order; the generic rows (shows in, group, hold, duplicate, delete) follow
function screenBlocks(it, B, dis, mv) {
  const r = it.rec, S = scrState(it), can = !scrCan(it), n = r.list.length, audio = r.look === 'audio', ord = scrOrder(r), sv = it.sv;
  const now = Math.round(screenClock()), t = scrT(S, now), path = scrPath(r, S.i), dur = SCR.dur.get(path) || 0;
  B.push({ h: r.name, sub: (audio ? 'Audio player' : 'Screen') + hiddenSub(it, it.shown) },
    { kv: [['Playing', `${baseName(path)} · ${S.i + 1} of ${n} · ${S.on ? 'playing' : 'paused'}`], ['Time', dur > 0 ? `${fmtT(t)} / ${fmtT(dur)}` : fmtT(t)], ['Plays for', scrOwn(it) ? 'each person on their own' : 'everyone here, in step'], ['Controls', r.ctl === 'any' ? 'anyone, editing or not' : 'only while editing']] });
  if (it.over) B.push({ p: 'Too many videos playing here: this one shows its card and is silent (its play state goes on).', c: 'amber' });
  if (sv && sv.err) B.push({ p: sv.err + ' (a format this browser cannot play: MP4 with H.264 and AAC plays on most; WebM on Chrome and Firefox).', c: 'amber' });
  if (!(HOST.audio && HOST.audio.fx && HOST.audio.fx())) B.push({ p: 'No sound yet: tap anywhere, or turn on the Sound button (the picture plays muted meanwhile).', c: 'faint' });
  else if (HOST.audio.muted) B.push({ p: 'The Sound button is off on this device: the picture plays, silent.', c: 'faint' });
  B.push({ label: 'Transport', row: [{ id: 'sc:prev', label: '⏮ Previous', act: 'scPrev', dis: can }, { id: 'sc:play', label: S.on ? '⏸ Pause' : '▶ Play', act: 'scPlay', dis: can, on: S.on }, { id: 'sc:next', label: 'Next ⏭', act: 'scNext', dis: can },
    { id: 'sc:b10', label: '−10 s', act: 'scSkip', v: -10, dis: can }, { id: 'sc:f10', label: '+10 s', act: 'scSkip', v: 10, dis: can }] });
  // the playlist: a page of eight (a headset's panel scrolls by pages): each entry (a press plays it), up, down, out
  const per = 8, page = clamp(SCR.listPage || 0, 0, Math.max(0, Math.ceil(n / per) - 1)), first = page * per;
  B.push({ label: `Playlist (${n}${r.shuffle ? ', shuffled' : ''})` });
  for (let k = first; k < Math.min(n, first + per); k++) {
    const li = ord[k];
    B.push({ row: [{ id: 'sc:go:' + k, label: `${k + 1}. ${baseName(r.list[li])}`, act: 'scGo', v: k, on: k === S.i, dis: can }, { id: 'sc:up:' + li, label: '↑', act: 'i:scMove', v: li + ':-1', dis: mv || li === 0 },
      { id: 'sc:dn:' + li, label: '↓', act: 'i:scMove', v: li + ':1', dis: mv || li === n - 1 }, { id: 'sc:del:' + li, label: '✕', act: 'i:scDel', v: li, dis: mv || n < 2, col: 'red' }] });
  }
  if (n > per) B.push({ row: [{ id: 'sc:lp:-', label: 'Earlier entries', act: 'i:scListPage', v: -1, dis: page === 0 }, { id: 'sc:lp:+', label: 'Later entries', act: 'i:scListPage', v: 1, dis: first + per >= n }] });
  const adding = SCR.adding === it.id;
  B.push({ row: [{ id: 'sc:add', label: adding ? 'Done adding' : 'Add to the playlist...', act: 'i:scAddOpen', on: adding, dis }] });
  if (adding) {
    const files = STU.files.filter(f => !inOriginals(f.path) && (f.kind === 'video' || f.kind === 'audio' || ['video', 'audio'].includes(scrKind(f.path))) && f.kind !== 'model'), ap = XR.on ? 8 : 12, pg = clamp(SCR.addPage || 0, 0, Math.max(0, Math.ceil(files.length / ap) - 1));
    B.push({ list: files.slice(pg * ap, pg * ap + ap).map(f => ({ id: 'sc:addf:' + f.path, label: f.path, sub: mb(f.bytes), act: 'i:scAdd', v: f.path, dis: dis || n >= SCR_MAX })) });
    if (files.length > ap) B.push({ row: [{ id: 'sc:ap:-', label: 'Earlier files', act: 'i:scAddPage', v: -1, dis: pg === 0 }, { id: 'sc:ap:+', label: 'Later files', act: 'i:scAddPage', v: 1, dis: (pg + 1) * ap >= files.length }] });
    if (!files.length) B.push({ p: 'No videos or sounds in the scene yet.', c: 'muted' });
  }
  B.push({ label: 'Look', row: [{ id: 'sc:look:screen', label: 'Screen', act: 'i:scLook', v: 'screen', on: !audio, dis }, { id: 'sc:look:audio', label: 'Audio player', act: 'i:scLook', v: 'audio', on: audio, dis }] },
    { label: `Width: ${metres(r.w)}`, row: [{ id: 'sc:w:-', label: '−0.2 m', act: 'i:scWidthD', v: -0.2, dis: mv }, { id: 'sc:w:+', label: '+0.2 m', act: 'i:scWidthD', v: 0.2, dis: mv }, { id: 'sc:w:h', label: '×0.5', act: 'i:scWidth', v: 0.5, dis: mv }, { id: 'sc:w:d', label: '×2', act: 'i:scWidth', v: 2, dis: mv }] },
    { label: 'Place', row: [{ id: 'turn', label: 'Turn 90°', act: 'i:turn', dis: mv }] },
    { label: 'When the list ends', row: [['all', 'Loop all'], ['one', 'Loop one'], ['off', 'Stop']].map(([k, n2]) => ({ id: 'sc:loop:' + k, label: n2, act: 'i:scLoop', v: k, on: r.loop === k, dis })).concat([{ id: 'sc:shuf', label: r.shuffle ? 'Shuffle: on' : 'Shuffle: off', act: 'i:scShuffle', v: r.shuffle ? 'off' : 'on', on: !!r.shuffle, dis }]) },
    { label: `Volume: ${Math.round(r.vol * 100)} %`, row: [{ id: 'sc:vol:-', label: 'Quieter', act: 'i:scVol', v: -0.25, dis }, { id: 'sc:vol:+', label: 'Louder', act: 'i:scVol', v: 0.25, dis }] },
    { label: `Full volume within ${metres(r.r)}`, row: [{ id: 'sc:reach:-', label: 'Nearer', act: 'i:scReach', v: -1, dis }, { id: 'sc:reach:+', label: 'Further', act: 'i:scReach', v: 1, dis }] },
    { label: 'Plays for', row: [{ id: 'sc:sync:all', label: 'Everyone here', act: 'i:scSync', v: 'all', on: !scrOwn(it), dis }, { id: 'sc:sync:own', label: 'Each person', act: 'i:scSync', v: 'own', on: scrOwn(it), dis }] },
    { p: scrOwn(it) ? 'Each person: a press here acts on this device only; everyone starts paused at the first entry.' : 'Everyone here: one play state for the whole circle (a press moves everyone\'s), at the room\'s time.', c: 'faint' },
    { label: 'Who can use the controls', row: [{ id: 'sc:ctl:edit', label: 'Only while editing', act: 'i:scCtl', v: 'edit', on: r.ctl !== 'any', dis }, { id: 'sc:ctl:any', label: 'Anyone', act: 'i:scCtl', v: 'any', on: r.ctl === 'any', dis }] },
    { p: 'The bar under the screen shows while it is pointed at (and for 3 s after). A press of it is never an Undo step.', c: 'faint' });
}
// what the panes' signature needs of the selected screen (its card: the entry, whether it plays, its time to the second, a headset's to ten)
function scrSig() {
  const it = STU.items.get(STU.sel);
  if (!it || it.kind !== 'v') return '';
  const S = scrState(it), t = scrT(S, Math.round(screenClock())), sv = it.sv;
  return [S.i, S.on, Math.floor(t / (XR.on ? 10 : 1)), !!it.over, sv && sv.err, scrOwn(it), SCR.dur.get(scrPath(it.rec, S.i)) > 0, !!(HOST.audio && HOST.audio.fx && HOST.audio.fx()), !!(HOST.audio && HOST.audio.muted)].join();
}
// words for the Items pane's card
const screenSub = r => (r.look === 'audio' ? 'Audio player' : 'Screen') + ` · ${r.list.length} entr${r.list.length === 1 ? 'y' : 'ies'}`;
// for tests (STUDIO.screen(id))
function screenState(id) {
  const it = STU.items.get(id);
  if (!it || it.kind !== 'v') return null;
  const S = scrState(it), sv = it.sv, ord = scrOrder(it.rec), path = scrPath(it.rec, S.i), L = it.look;
  return { rec: it.rec, i: S.i, order: ord, path, t: scrT(S, Math.round(screenClock())), dur: SCR.dur.get(path) || 0, on: S.on, state: S, own: scrOwn(it),
    el: sv ? { src: sv.el.currentSrc || sv.el.src, currentTime: sv.el.currentTime, paused: sv.el.paused, muted: sv.el.muted, readyState: sv.el.readyState, volume: sv.gt, drift: sv.drift, fixes: sv.fixes, ctx: !!sv.ctx, pan: sv.pan ? { x: sv.pan.positionX ? sv.pan.positionX.value : null, y: sv.pan.positionY ? sv.pan.positionY.value : null, z: sv.pan.positionZ ? sv.pan.positionZ.value : null, ref: sv.pan.refDistance, model: sv.pan.panningModel } : null } : null,
    drawn: !!(sv && sv.drawn && L.mat.map === sv.tex), over: !!it.over, shown: it.shown, bar: { visible: L.bar.visible, pos: L.bar.position.toArray(), w: L.bar.scale.x, h: L.bar.scale.y, can: scrCan(it) }, ext: L.ext.slice(), vol: scrOwn(it) && it.ownVol != null ? it.ownVol : it.rec.vol,
    card: L.mat.map === L.cardTex, log: SCR.log.slice(), err: sv ? sv.err : '' };
}

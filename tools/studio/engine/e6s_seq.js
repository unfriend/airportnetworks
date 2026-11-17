// ================================================================ SEQUENCES ==
// The owner, 15 November 2026 (tools/studio/SPEC.md, "Sequences"): "A kind of timeline that can playback animations, show
// items, hide them, play audiofiles on items, etc". A sequence is an item of kind q (no place, no holder of its own, as a
// group has none): { name, len, loop, start, sync, col, ev, locked }, its events { t, on, what, clip?, how?, fade?, mat?,
// slot?, file? } sorted by time. What each event does is what a cube's entry does (e6n_plays.js: clips, sounds, recorded
// paths and motions run through the same runs), plus show and hide (one more source in the cubes' "entered last decides"
// rule), a picture on an object (as a cube's texture change) and starting or stopping another sequence.
// The play state is NOT part of the record: qr.<id> in the room's state (or each device's own for sync 'own'), { n, on, at,
// t, ts, by }: shared on the room's clock, never in layout.json, the draft, Unsaved changes or Undo. Every device works the
// whole result out from that value and the room's time (a late joiner too): firing the events at or before where the
// sequence is now, the runs' own code placing each where it would be by now.
const SEQ_EV_MAX = 200, SEQ_EV_SCENE = 2000, SEQ_COL = '#46d9ff', SEQ_WHAT = ['clip', 'sound', 'path', 'motion', 'show', 'hide', 'tex', 'seq'];
// (what show and hide may name: a cube too, v154, switched on and off; what a cube's lists, a press's entries and a sequence's events take)
const SEQ_RUN = ['clip', 'sound', 'path', 'motion'], SEQ_SHOW = ['o', 's', 'p', 'e', 'v', 'd', 'x', 'c'];
const SEQ = { last: new Map(), nudge: null, opened: -1, t0: 0, log: [], fired: 0, parents: null, rev: -1, texList: [], texRev: -1, page: 0 };
Object.assign(STU, { qr: new Map(), qOwn: new Map(), qprev: null, qsel: -1, badSeq: 0 });
const seqNow = () => behNow();
// a room moment (ms) on the runs' clock and back (as triggerStep maps an everyone cube's moments)
const roomToRun = m => m - (behNow() - trgClock());
const runToRoom = T => T + (behNow() - trgClock());
const seqRec = id => { const q = STU.items.get(id); return q && q.kind === 'q' ? q : null; };
const seqQs = () => [...STU.items.values()].filter(q => q.kind === 'q');

// ---------------------------------------------------------------- the record --
// what an event's target may be, by what
const seqKinds = what => (what === 'show' || what === 'hide' ? SEQ_SHOW : what === 'tex' ? ['o'] : what === 'seq' ? ['q'] : PLAY_KINDS[what]);
function normSeqEv(list, self) {
  const out = [];
  for (const e of list) {
    if (out.length >= SEQ_EV_MAX) break;
    if (!e || typeof e !== 'object' || Array.isArray(e) || !fin(e.t) || e.t < 0 || e.t > 600 || !okId(e.on) || !SEQ_WHAT.includes(e.what) || e.on === self) continue;
    const r = { t: r2(e.t), on: e.on, what: e.what };
    if (SEQ_RUN.includes(e.what)) {
      const how = e.how === undefined ? 'once' : e.how;
      if (!PLAY_HOW.includes(how) || (how === 'hold' && e.what !== 'clip' && e.what !== 'path')) continue;
      if (e.what === 'clip' && how !== 'stop') { if (typeof e.clip !== 'string' || !e.clip.trim()) continue; r.clip = e.clip.slice(0, 120); }
      r.how = how;
    } else if (e.what === 'seq') {
      const how = e.how === undefined ? 'once' : e.how;
      if (how !== 'once' && how !== 'stop') continue;
      r.how = how;
    } else if (e.what === 'show' || e.what === 'hide') {
      if (e.fade !== undefined && e.fade !== null && e.fade !== 'cut') continue;
      if (e.fade === 'cut') r.fade = 'cut';
    } else {
      if (!Number.isInteger(e.mat) || e.mat < 0 || e.mat > 255 || !TXS_SLOTS.includes(e.slot)) continue;
      if (!(e.file === '' || (okFile(e.file) && CONV.IM.isPicture(e.file)))) continue;
      r.mat = e.mat; r.slot = e.slot; r.file = e.file;
    }
    out.push(r);
  }
  return out.map((e, i) => [e, i]).sort((a, b) => a[0].t - b[0].t || a[1] - b[1]).map(x => x[0]);
}
function normSeq(x, name, self) {
  const has = k => x[k] !== undefined;
  const r = { name: name('Sequence') };
  r.len = !has('len') ? 10 : fin(x.len) ? r2(Math.min(600, Math.max(0.1, x.len))) : null;
  if (has('loop') && x.loop !== 'off' && x.loop !== 'loop') return null;
  if (x.loop === 'loop') r.loop = 'loop';
  if (has('start') && x.start !== 'press' && x.start !== 'open') return null;
  if (x.start === 'open') r.start = 'open';
  if (has('sync') && x.sync !== 'own' && x.sync !== 'all') return null;
  if (x.sync === 'own') r.sync = 'own';
  if (has('col') && x.col !== null) { if (typeof x.col !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(x.col)) return null; r.col = x.col.toLowerCase(); }
  if (has('ev')) { if (!Array.isArray(x.ev)) return null; r.ev = normSeqEv(x.ev, self); } else r.ev = [];
  if (x.send != null) { const t = sendKeep(x.send, 'q'); if (t === null) return null; if (t) r.send = t; }   // (its sends to the output page, v157: e6u_send.js)
  return lockOf(x, r);
}
// a play state as the room keeps it (null: not one)
function normQr(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const { n, at, t, ts } = v;
  if (!Number.isInteger(n) || n < 0 || typeof v.on !== 'boolean' || !fin(at) || at < 0 || !fin(t) || t < -1 || t > 600 || !fin(ts) || ts < 0) return null;
  return { n, on: v.on, at: Math.round(at), t: r2(t), ts: Math.round(ts), by: typeof v.by === 'string' ? words(v.by, 40) : '' };
}
const seqEvCount = (except) => seqQs().reduce((n, q) => n + (q.id === except ? 0 : q.rec.ev.length), 0);

// --------------------------------------------------------------- play state --
// the record's state (shared or own), else null; a preview here wins on this device (nothing written)
const seqBase = q => (q.rec.sync === 'own' ? STU.qOwn : STU.qr).get(q.id) || null;
// where a state puts the sequence at room time Tr: { u (s in the cycle), cyc, playing, ended, at0 (the room moment of its time 0 in
// this run), stopAt }, or null while it is rewound or never started
function seqU(q, P, Tr) {
  if (!P || (P.t === -1 && !P.on)) return null;
  const len = q.rec.len, loop = q.rec.loop === 'loop';
  let playing = !!P.on, u, cyc = 0, ended = false;
  if (playing) {
    u = Math.max(0, (Tr - P.at) / 1000);
    if (loop) { cyc = Math.floor(u / len); u -= cyc * len; } else if (u >= len) { u = len; ended = true; playing = false; }
  } else u = Math.min(len, Math.max(0, P.t));
  // stopped in a loop: which cycle it was in (so what an earlier cycle showed stays), and the run's own start as time 0
  let at0 = P.on ? P.at : P.ts - P.t * 1000;
  if (!P.on && loop && P.at > 0 && P.ts >= P.at) { cyc = Math.max(0, Math.round(((P.ts - P.at) / 1000 - u) / len)); at0 = P.at; }
  return { u, cyc, playing, ended, at0, stopAt: ended ? P.at + len * 1000 : P.ts };
}
// the sequences that start this one (a seq event naming it), made again when the items change
function seqParents(id) {
  if (SEQ.rev !== STU.rev) {
    SEQ.rev = STU.rev; SEQ.parents = new Map();
    for (const p of seqQs()) for (const e of p.rec.ev) if (e.what === 'seq' && e.on !== p.id) { if (!SEQ.parents.has(e.on)) SEQ.parents.set(e.on, new Map()); const m = SEQ.parents.get(e.on); if (!m.has(p.id)) m.set(p.id, { p, evs: [] }); m.get(p.id).evs.push(e); }
  }
  const m = SEQ.parents.get(id);
  return m ? [...m.values()] : [];
}
// a sequence's effective play state: its record's (room or own), or one derived from a playing sequence that starts or stops it
// (never written: every device works it out alike), whichever is later; a preview here wins. Depth at most 4
function seqEff(q, d = 0, Tr = behNow(), noPv = false) {
  const pv = !noPv && STU.qprev && STU.qprev.id === q.id ? STU.qprev : null;
  if (pv) return { n: -1, on: pv.on, at: pv.at, t: pv.t, ts: pv.ts, by: '', src: 'preview' };
  const b = seqBase(q);
  let best = b ? Object.assign({ src: q.rec.sync === 'own' ? 'own' : 'room' }, b) : null;
  if (d >= 4) return best;
  const cands = [];
  for (const { p, evs } of seqParents(q.id)) {
    const P = seqEff(p, d + 1, Tr), U = seqU(p, P, Tr);
    if (!U) continue;
    const len = p.rec.len;
    for (const e of evs) {
      let cyc = U.cyc, m = null;
      if (e.t <= U.u) m = U.at0 + (cyc * len + e.t) * 1000;
      else if (cyc >= 1) m = U.at0 + ((cyc - 1) * len + e.t) * 1000;
      if (m !== null) cands.push({ m, how: e.how });
    }
  }
  cands.sort((a, b2) => a.m - b2.m);
  for (const c of cands) {
    if (best && c.m < best.ts) continue;
    if (c.how === 'stop') {
      if (!best) continue;
      const U = seqU(q, best, c.m);
      if (!U) continue;
      best = { n: 0, on: false, at: best.at, t: r2(U.u), ts: Math.round(c.m), by: '', src: 'derived' };
    } else best = { n: 0, on: true, at: Math.round(c.m), t: 0, ts: Math.round(c.m), by: '', src: 'derived' };
  }
  return best;
}
const seqCan = () => !editLocked();
// (the output page is named so in the room, whatever this device's own name: its presses and starts say so, and the output page
// knows them as its own, e6u_send.js)
const seqWho = () => { try { return HOST.collab && HOST.collab.joined ? (outPage() ? 'Output page' : HOST.collab.name ? words(HOST.collab.name, 40) : '') : ''; } catch (e) { return ''; } };
// a command on a sequence's play state at room moment m (now): start (from its beginning), stop (held at where it is) or rewind
// (nothing of it applies). No Undo step, no change: it is not an edit. One device writes at most once in 150 ms for a
// sequence (a second within it takes the first one's number)
function seqCmd(id, cmd, m, why) {
  const q = seqRec(id);
  if (!q) return false;
  m = Math.round(m === undefined ? behNow() : m);
  const own = q.rec.sync === 'own', M = own ? STU.qOwn : STU.qr, prev = M.get(id), L = SEQ.last.get(id), fast = L && performance.now() - L.at < 150;
  let val;
  const n = (prev ? prev.n : 0) + (fast ? 0 : 1);
  if (cmd === 'start') val = { n, on: true, at: m, t: 0, ts: m, by: seqWho() };
  else if (cmd === 'rewind') val = { n, on: false, at: 0, t: -1, ts: m, by: seqWho() };
  else if (cmd === 'stop') {
    const P = seqEff(q, 0, behNow(), true), U = seqU(q, P, m);   // (never the preview here: it writes nothing of its own)
    // (stopped already: nothing, v149; a new ts on a stopped loop would move it to another cycle, seqU)
    if (!U || !P || !P.on) return false;
    val = { n, on: false, at: P.at, t: r2(U.u), ts: m, by: seqWho() };
  } else return false;
  M.set(id, val); SEQ.last.set(id, { at: performance.now() });
  SEQ.log.push([cmd, id, m, why || '']); if (SEQ.log.length > 100) SEQ.log.shift();
  dirty();
  return true;
}
const seqPlay = (id, why) => seqCmd(id, 'start', undefined, why || 'card');
const seqStop = (id, why) => seqCmd(id, 'stop', undefined, why || 'card');
const seqRewind = (id, why) => seqCmd(id, 'rewind', undefined, why || 'card');

// ------------------------------------------------------------ each frame --
// first in triggerStep's end: each sequence's place (q.sc = { P, U }, null rewound), then its show and hide events as sources
// of the cubes' rule (the last at or before where it is, in this cycle, else the last of the one before); an item named by a
// sequence waits until shown (LISTS.shown). Also the starts when the scene opens
const _sqD = new Set();
function seqShowHide(S, H, Tr) {
  seqOpenStep(Tr);
  for (const q of STU.items.values()) {
    if (q.kind !== 'q') continue;
    const P = seqEff(q, 0, Tr), U = seqU(q, P, Tr);
    q.sc = U ? { P, U } : null;
    q.stx = null;
    if (!U) continue;
    const evs = q.rec.ev, len = q.rec.len;
    _sqD.clear();
    let tex = null;
    for (let cyc = U.cyc; cyc >= Math.max(0, U.cyc - 1); cyc--) {
      for (let i = evs.length - 1; i >= 0; i--) {
        const e = evs[i];
        if (cyc === U.cyc && e.t > U.u) continue;
        if (e.what === 'show' || e.what === 'hide') {
          if (_sqD.has(e.on)) continue;
          _sqD.add(e.on);
          const src = { id: q.id, since: U.at0 + (cyc * len + e.t) * 1000, cut: e.fade === 'cut' }, M = e.what === 'show' ? S : H;
          if (enteredLater(src, M.get(e.on))) M.set(e.on, src);
        } else if (e.what === 'tex') {
          const k = e.on + '|' + e.mat + '|' + e.slot;
          if (_sqD.has(k)) continue;
          _sqD.add(k);
          (tex || (tex = [])).push({ on: e.on, mat: e.mat, slot: e.slot, file: e.file, since: U.at0 + (cyc * len + e.t) * 1000, id: q.id });
        }
      }
    }
    q.stx = tex;
  }
}
// the events of run kinds fired as the sequence moves (a new state, a late join or a scene opened: every one at or before
// now, in the current cycle; else the ones crossed since the last frame), each through the cubes' runs (trgStart, src 'seq');
// loops and holds come off when it stops or ends, a rewind clears every run at once
function seqFire(Tr) {
  trgList();
  for (const q of STU.items.values()) {
    if (q.kind !== 'q') continue;
    const sc = q.sc;
    if (!sc) { if (!q.sq || q.sq.key !== 'none') { seqClear(q); q.sq = { key: 'none', u: 0, cyc: 0 }; } continue; }
    const { P, U } = sc, key = P.n + '|' + P.at + '|' + P.on + '|' + P.ts + '|' + P.src, evs = q.rec.ev, len = q.rec.len;
    const fire = (cyc, lo, hi) => {
      for (let i = 0; i < evs.length; i++) {
        const e = evs[i];
        if (e.t <= lo || e.t > hi || !SEQ_RUN.includes(e.what)) continue;
        const t = STU.items.get(e.on);
        if (!t || !PLAY_KINDS[e.what].includes(t.kind)) continue;
        SEQ.fired++;
        trgStart({ c: q, e, ek: q.id + '|' + i + '|' + cyc, src: 'seq' }, roomToRun(U.at0 + (cyc * len + e.t) * 1000), false);
      }
    };
    if (!q.sq || q.sq.key !== key) { seqClear(q); q.sq = { key, u: U.u, cyc: U.cyc, fired: 0 }; const n0 = SEQ.fired; fire(U.cyc, -1, U.u); q.sq.fired = SEQ.fired - n0; }
    else {
      const S0 = q.sq;
      if (U.cyc === S0.cyc) fire(U.cyc, S0.u, U.u);
      else if (U.cyc === S0.cyc + 1) { fire(S0.cyc, S0.u, len); fire(U.cyc, -1, U.u); }
      else fire(U.cyc, -1, U.u);
      q.sq = { key, u: U.u, cyc: U.cyc, fired: S0.fired };
    }
    if (!U.playing) {
      for (const t of TRG.on) for (const k of PLAY_WHAT) {
        const R = t.tr && t.tr[k];
        if (R && R.c === q && !R.off && (R.e.how === 'loop' || R.e.how === 'hold')) trgOff(R, Math.min(trgClock(), roomToRun(U.stopAt)), 'stopped');
      }
    }
  }
  // (runs of a sequence deleted: loops and holds come off)
  for (const t of TRG.on) for (const k of PLAY_WHAT) {
    const R = t.tr && t.tr[k];
    if (R && R.src === 'seq' && !R.off && STU.items.get(R.c.id) !== R.c && (R.e.how === 'loop' || R.e.how === 'hold')) trgOff(R, trgClock(), 'gone');
  }
}
// every run a sequence started taken off at once (no fade): layers stopped, sounds stopped
function seqClear(q) {
  for (const t of [...TRG.on]) {
    if (t.tl) { const keep = []; for (const y of t.tl) { if (y.R.c === q) { try { y.a.stop(); } catch (e) { /* gone */ } } else keep.push(y); } t.tl = keep.length ? keep : null; }
    for (const k of PLAY_WHAT) { const R = t.tr && t.tr[k]; if (R && R.c === q) { if (k === 'sound') emitStop(t); trgDone(t, k, R, 'clear'); } }
  }
}
// Reset what I have seen and the lobby: own states forgotten, every sequence fires afresh from its state next frame
function seqReset() {
  STU.qOwn.clear();
  for (const q of seqQs()) { q.sq = null; q.sc = null; }
  SEQ.opened = -1; SEQ.t0 = performance.now();
}
// start: 'open': written once 1.5 s after the scene's items are in (a state of its own, so a late device finds it playing)
function seqOpenStep(Tr) {
  if (STU.listing !== 'ok') { SEQ.opened = -1; SEQ.t0 = 0; return; }
  if (SEQ.opened === STU.gen) return;
  if (!SEQ.t0) SEQ.t0 = performance.now();
  if (performance.now() - SEQ.t0 < (SEQ.wait === undefined ? 1500 : SEQ.wait)) return;
  SEQ.opened = STU.gen;
  for (const q of seqQs()) if (q.rec.start === 'open' && !seqBase(q)) seqCmd(q.id, 'start', Tr, 'open');
}

// ---------------------------------------------------------------- pictures --
// the pictures the sequences' tex events name (read as the cubes' are) and what each object wants from them now
function seqTexEvents() {
  if (SEQ.texRev !== STU.rev) { SEQ.texRev = STU.rev; SEQ.texList = []; for (const q of seqQs()) for (const e of q.rec.ev) if (e.what === 'tex') SEQ.texList.push(e); }
  return SEQ.texList;
}
const seqHasTex = () => seqTexEvents().length > 0;
function seqTexNeed(want) {
  for (const e of seqTexEvents()) {
    const o = STU.items.get(e.on);
    if (!e.file || !o || o.kind !== 'o' || !STU.fileMap.has(e.file)) continue;
    if (!want.has(e.file)) want.set(e.file, new Set());
    want.get(e.file).add(!isGltf(o.rec.file));
  }
}
function seqTexWant(want) {
  for (const q of STU.items.values()) {
    if (q.kind !== 'q' || !q.stx) continue;
    for (const x of q.stx) {
      let m = want.get(x.on);
      if (!m) want.set(x.on, (m = new Map()));
      const k = x.mat + '|' + x.slot, w = m.get(k);
      if (!w || enteredLater(x, w)) m.set(k, { e: x.file ? { on: x.on, mat: x.mat, slot: x.slot, file: x.file } : null, since: x.since, id: x.id });
    }
  }
}

// ------------------------------------------------------------ preview --
// this device's own, while editing: the sequence played or held here at a moment, the room's state ignored here (nothing is
// written); ends with editing, another selection or End preview
function seqPreview(q, u, on) {
  const now = behNow();
  STU.qprev = { id: q.id, on: !!on, at: Math.round(now - u * 1000), t: r2(Math.min(q.rec.len, Math.max(0, u))), ts: Math.round(now) };
}
function seqPrevU(q) { const P = seqEff(q), U = seqU(q, P, behNow()); return U ? U.u : 0; }
function seqScrub(f) {
  const q = STU.items.get(STU.sel);
  if (!q || q.kind !== 'q' || !editOn()) return;
  seqPreview(q, Math.min(1, Math.max(0, f)) * q.rec.len, false);
  dirty();
}
function seqPreviewToggle(q) {
  const pv = STU.qprev && STU.qprev.id === q.id ? STU.qprev : null, u = seqPrevU(q);
  if (pv && pv.on) seqPreview(q, u, false);
  else seqPreview(q, pv || !seqEff(q) ? (u >= q.rec.len - 1e-6 ? 0 : u) : u, true);
}
// the bar of the card (a headset's, drawn by drawBar through animBar('seq')): its time, length, whether it is a preview, plays
function seqBar() {
  const q = STU.items.get(STU.sel);
  if (!q || q.kind !== 'q') return null;
  const P = seqEff(q), U = seqU(q, P, behNow());
  return { t: U ? U.u : 0, d: q.rec.len, held: !!(STU.qprev && STU.qprev.id === q.id), p: !!(U && U.playing), mine: true };
}

// ------------------------------------------------------------- the card --
const seqCol = r => r.col || SEQ_COL;
const evSecs = t => t.toFixed(2) + ' s';
function seqEvWords(e) {
  const t = STU.items.get(e.on), nm = t ? t.rec.name : 'an item not in the scene', T = evSecs(e.t);
  let w;
  if (e.what === 'clip') w = e.how === 'stop' ? 'stops its animation' : `${e.clip} · ${e.how}`;
  else if (e.what === 'sound') w = e.how === 'stop' ? 'stops' : e.how === 'loop' ? 'the sound · loops' : 'the sound · once';
  else if (e.what === 'path') w = e.how === 'stop' ? 'stops its path' : `its recorded path · ${e.how}`;
  else if (e.what === 'motion') w = e.how === 'stop' ? 'stops its motion' : `its motion · ${e.how}`;
  else if (e.what === 'show') w = t && t.kind === 'c' ? 'switches on' : e.fade === 'cut' ? 'shows (at once)' : 'shows';   // (a cube: switched on and off, v154)
  else if (e.what === 'hide') w = t && t.kind === 'c' ? 'switches off' : e.fade === 'cut' ? 'hides (at once)' : 'hides';
  else if (e.what === 'tex') w = `${SLOT_NAME[e.slot] || e.slot} → ${e.file ? baseName(e.file) : 'its own picture'}`;
  else w = e.how === 'stop' ? 'stops' : 'starts';
  return `${T} · ${nm} · ${w}`;
}
function seqWhy(e) {
  const t = STU.items.get(e.on);
  if (!t || !seqKinds(e.what).includes(t.kind)) return 'It names an item not in the scene (or one this cannot be done to).';
  if (SEQ_RUN.includes(e.what)) return playWhy(e);
  return '';
}
function seqStateWords(q) {
  const P = seqEff(q), U = seqU(q, P, behNow()), len = q.rec.len;
  if (!U) return 'Not started';
  const by = P.by ? ` · started by ${P.by}` : '';
  if (P.src === 'preview') return (U.playing ? `Preview here: playing, ${len.toFixed(1)} s long` : U.ended ? 'Preview here: ended' : 'Preview here: held (the bar shows where)') + ' · the others see the room\'s state';
  if (U.playing) return `Playing, ${len.toFixed(1)} s long${by}` + (P.src === 'derived' ? ' · started by a sequence' : '');
  return U.ended ? 'Ended' + by : `Stopped at ${U.u.toFixed(1)} s` + by;
}
// what can be done to an item in an event: its run kinds, show and hide, a picture on an object, starting a sequence
function seqOpts(t) {
  if (!t) return [];
  const out = playOpts(t).filter(o => !o.dis);
  if (t.kind === 'c') out.push({ what: 'show', label: 'Switch it on' }, { what: 'hide', label: 'Switch it off' });   // (a cube, v154: shown and hidden is switched on and off)
  else if (SEQ_SHOW.includes(t.kind)) out.push({ what: 'show', label: 'Show it' }, { what: 'hide', label: 'Hide it' });
  if (t.kind === 'o') out.push({ what: 'tex', label: 'Change a texture...' });
  return out;
}
const SQ_HOWS = { clip: ['once', 'loop', 'hold', 'stop'], path: ['once', 'loop', 'hold', 'stop'], sound: ['once', 'loop', 'stop'], motion: ['once', 'loop', 'stop'], seq: ['once', 'stop'] };
const sqHowWord = (w, h) => (w === 'seq' ? (h === 'stop' ? 'Stop it' : 'Start it') : HOW_WORD[h]);
function sqDraft(P) {
  const e = { t: P.at, on: P.on, what: P.what };
  if (P.what === 'clip' && P.how !== 'stop') e.clip = P.clip;
  if (SEQ_RUN.includes(P.what) || P.what === 'seq') e.how = P.how;
  if ((P.what === 'show' || P.what === 'hide') && P.fade === 'cut') e.fade = 'cut';
  if (P.what === 'tex') { e.mat = P.mat; e.slot = P.slot; e.file = P.file; }
  return e;
}
function sqSentence(P) {
  const t = STU.items.get(P.on);
  if (!t || !P.what) return 'Pick what to do.';
  const nm = t.rec.name, T = `At ${P.at.toFixed(2)} s, `, h = P.how;
  if (t.kind === 'c' && (P.what === 'show' || P.what === 'hide')) return `${T}the cube ${nm} is switched ${P.what === 'show' ? 'on' : 'off'}.`;   // (v154)
  if (P.what === 'show') return `${T}${nm} shows${P.fade === 'cut' ? ' at once' : ' (fades in)'}.`;
  if (P.what === 'hide') return `${T}${nm} hides${P.fade === 'cut' ? ' at once' : ' (fades out)'}.`;
  if (P.what === 'tex') return `${T}${nm}'s ${(SLOT_NAME[P.slot] || P.slot).toLowerCase()} becomes ${P.file ? baseName(P.file) : 'its own picture'}.`;
  if (P.what === 'seq') return `${T}${nm} ${h === 'stop' ? 'stops' : 'starts from its beginning'}.`;
  if (h === 'stop') return `${T}${nm} stops what a sequence or a cube started.`;
  const what = P.what === 'clip' ? P.clip : P.what === 'sound' ? 'the sound' : P.what === 'path' ? 'its recorded path' : 'its motion';
  return `${T}${nm} plays ${what} ${h === 'once' ? 'once from its start' : h === 'loop' ? 'again and again until the sequence stops' : 'to its end and holds there until the sequence stops'}.`;
}
// a list as a page's list, a headset's pages of eight
function sqPaged(B, label, rows, page, act) {
  const per = 8, pages = Math.max(1, Math.ceil(rows.length / per)), pg = Math.min(page, pages - 1);
  B.push({ page: true, label, list: rows }, { xr: true, label, list: rows.slice(pg * per, pg * per + per) });
  if (pages > 1) B.push({ xr: true, label: `${pg * per + 1} to ${Math.min(rows.length, pg * per + per)} of ${rows.length}`, row: [{ id: act + ':-', label: '◂ Previous', act: 'i:' + act, v: -1, dis: pg <= 0 }, { id: act + ':+', label: 'Next ▸', act: 'i:' + act, v: 1, dis: pg >= pages - 1 }] });
}
const NUDGES = [-0.5, -0.1, 0.1, 0.5];
function seqBlocks(q, B, dis, ed) {
  const r = q.rec, ld = dis || !!r.locked, can = seqCan(), own = r.sync === 'own', n = r.ev.length, full = n >= SEQ_EV_MAX || seqEvCount() >= SEQ_EV_SCENE;
  const P = STU.plp && STU.plp.id === q.id && STU.plp.seq ? STU.plp : null;
  const col = seqCol(r), pv = STU.qprev && STU.qprev.id === q.id;
  B.push({ h: r.name, sub: 'Sequence' });
  B.push({ kv: [['Length', r.len.toFixed(1) + ' s' + (r.loop ? ' · loops' : '')], ['State', seqStateWords(q)], ['Plays for', own ? 'each person on their own' : 'everyone here, in step'], ['Starts', r.start === 'open' ? 'by itself when the scene opens, or by a Play, a cube or a press' : 'by a Play, a cube, a press or another sequence']] });
  B.push({ label: 'Transport', row: [{ id: 'sq:play', label: own ? '▶ Play' : '▶ Play for everyone', act: 'sqPlay', dis: !can }, { id: 'sq:stop', label: '⏹ Stop', act: 'sqStop', dis: !can }, { id: 'sq:rew', label: '⏮ Rewind', act: 'sqRewind', dis: !can }] });
  if (ed) B.push({ label: 'Preview (this device only)', row: [{ id: 'sq:pv', label: pv && STU.qprev.on ? '⏸ Pause preview' : '▶ Play here (preview)', act: 'sqPreview', on: pv }, { id: 'sq:pvend', label: 'End preview', act: 'sqPreviewEnd', dis: !pv }] });
  if (ed && pv) B.push({ p: 'Preview here: the others see the room\'s state. It ends when you select something else or stop editing.', c: 'faint' });
  B.push({ xr: true, bar: { id: 'seqbar', ch: 'seq' } });
  B.push({ label: `Length: ${r.len.toFixed(1)} s`, row: [[-1, '−1 s'], [-0.1, '−0.1 s'], [0.1, '+0.1 s'], [1, '+1 s']].map(([d, l]) => ({ id: 'sqlen:' + d, label: l, act: 'i:sqLen', v: d, dis: ld })) });
  B.push({ label: 'Loop', row: [{ id: 'sqloop:off', label: 'Off', act: 'i:sqLoop', v: 'off', on: !r.loop, dis: ld }, { id: 'sqloop:on', label: 'Loop', act: 'i:sqLoop', v: 'loop', on: !!r.loop, dis: ld }] });
  B.push({ label: 'Starts', row: [{ id: 'sqst:press', label: 'By Play, a cube or a press', act: 'i:sqStart', v: 'press', on: r.start !== 'open', dis: ld }, { id: 'sqst:open', label: 'When the scene opens', act: 'i:sqStart', v: 'open', on: r.start === 'open', dis: ld }] });
  B.push({ label: 'Who', row: [{ id: 'sqwho:all', label: 'Everyone here', act: 'i:sqSync', v: 'all', on: !own, dis: ld }, { id: 'sqwho:own', label: 'Each person', act: 'i:sqSync', v: 'own', on: own, dis: ld }] });
  B.push({ label: 'Colour', row: SHAPE_COLS.map(([c, nm]) => ({ id: 'sqcol:' + c, label: nm, act: 'i:sqCol', v: c, on: col === c, sw: c, dis: ld })) },
    { page: true, colour: { id: 'stuSqCol', act: 'i:sqCol', tgt: 'seq', value: col, label: 'Any colour…', dis: ld } },
    { xr: true, row: [{ id: 'cpk:seq', label: 'Any colour…', act: 'cpkOpen', v: 'seq', on: !!CPK.open && CPK.open.tgt === 'seq', sw: col, dis: ld }] },
    ...(CPK.open && CPK.open.where === 'xr' && CPK.open.tgt === 'seq' ? [{ xr: true, picker: { id: 'cpk', tgt: 'seq' } }] : []));
  // the events: a row each in time order (a press selects it, flashes its item and holds the preview there), nudges, ✕
  const per = XR.on ? 8 : n, pages = Math.max(1, Math.ceil(n / per)), pg = Math.min(STU.qpage || 0, pages - 1);
  B.push({ label: `Events (${n})` });
  if (!n) B.push({ p: 'No events yet: Add an event... (a clip, a sound, a path or a motion on an item, show or hide it, change a picture, start another sequence).', c: 'faint' });
  for (let k = pg * per; k < Math.min(n, pg * per + per); k++) {
    const e = r.ev[k], why = seqWhy(e), late = e.t > r.len;
    B.push({ row: [{ id: 'sqe:' + k, label: seqEvWords(e) + (late ? ' · past the end' : ''), act: 'i:sqSel', v: k, on: STU.qsel === k, dis: false }]
      .concat(NUDGES.map(d => ({ id: `sqn:${k}:${d}`, label: (d > 0 ? '+' : '−') + Math.abs(d), act: 'i:sqNudge', v: k + ':' + d, dis: ld })), [{ id: 'sqx:' + k, label: '✕', act: 'i:sqDel', v: k, dis: ld, col: 'red' }]) });
    if (why) B.push({ p: why, c: 'amber' });
  }
  if (pages > 1) B.push({ xr: true, label: `${pg * per + 1} to ${Math.min(n, pg * per + per)} of ${n}`, row: [{ id: 'sqep:-', label: '◂ Earlier', act: 'i:sqEvPg', v: -1, dis: pg <= 0 }, { id: 'sqep:+', label: 'Later ▸', act: 'i:sqEvPg', v: 1, dis: pg >= pages - 1 }] });
  // Add an event...: the item, what, how, at
  const cands = [...STU.items.values()].filter(t => t.id !== q.id && seqOpts(t).length);
  B.push({ row: [{ id: 'sqadd', label: P ? 'Cancel' : 'Add an event...', act: 'i:sqPick', on: !!P, dis: ld || (!P && (full || !cands.length)) }] });
  if (full) B.push({ p: `${n >= SEQ_EV_MAX ? SEQ_EV_MAX + ' events: the most a sequence takes' : SEQ_EV_SCENE + ' events: the most a scene takes'}.`, c: 'amber' });
  if (P && P.step === 'obj') {
    B.push({ p: (XR.on ? 'Point at it and pull the trigger' : 'Click it in the scene, or pick it here') + ': an item to play something on, show or hide, a cube to switch on or off, or another sequence.', c: 'amber' });
    sqPaged(B, `Items (${cands.length})`, cands.map(t => ({ id: 'sqon:' + t.id, label: t.rec.name, sub: KIND_NAME[t.kind], act: 'i:sqOn', v: t.id, dis: ld })), P.page, 'sqPg');
  } else if (P) {
    const t = STU.items.get(P.on), opts = seqOpts(t);
    B.push({ kv: [['Target', t ? `${t.rec.name} · ${KIND_NAME[t.kind]}` : 'not in the scene']] }, { row: [{ id: 'sqback', label: 'Another item...', act: 'i:sqBack', dis: ld }] });
    const clips = opts.filter(o => o.what === 'clip'), others = opts.filter(o => o.what !== 'clip');
    if (t && t.kind === 'o' && !t.model) B.push({ p: `${t.rec.name}'s model is not here yet: its animations show once it is.`, c: 'faint' });
    if (clips.length) sqPaged(B, `Its animations (${clips.length})`, clips.map(o => ({ id: 'sqwhat:clip:' + o.clip, label: o.clip, sub: o.sub, act: 'i:sqWhat', v: 'clip:' + o.clip, on: P.what === 'clip' && P.clip === o.clip, dis: ld })), P.cpage, 'sqCPg');
    if (others.length) B.push({ label: clips.length ? 'Or' : 'What', row: others.map(o => ({ id: 'sqwhat:' + o.what, label: o.label, act: 'i:sqWhat', v: o.what, on: P.what === o.what, dis: ld })) });
    if (!opts.length) B.push({ p: 'Nothing to do to it now.', c: 'amber' });
    else if (P.what) {
      if (SQ_HOWS[P.what]) B.push({ label: 'How', row: SQ_HOWS[P.what].map(h => ({ id: 'sqhow:' + h, label: sqHowWord(P.what, h), act: 'i:sqHow', v: h, on: P.how === h, dis: ld })) });
      if ((P.what === 'show' || P.what === 'hide') && t.kind !== 'c') B.push({ label: 'How', row: [{ id: 'sqfade:fade', label: 'Fade', act: 'i:sqFade', v: '', on: P.fade !== 'cut', dis: ld }, { id: 'sqfade:cut', label: 'At once', act: 'i:sqFade', v: 'cut', on: P.fade === 'cut', dis: ld }] });
      if (P.what === 'tex') {
        const ms = t.model ? ctMats(t) : [];
        if (!t.model) B.push({ p: `${t.rec.name}'s model is not here yet: its materials show once it is.`, c: 'faint' });
        else if (!ms.length) B.push({ p: `${t.rec.name} has no texture coordinates (UVs): a picture cannot be laid on it.`, c: 'amber' });
        else {
          const m = ms[P.mat] || ms[0];
          if (ms.length > 1) B.push({ label: 'Its material', list: ms.map((x, i) => ({ id: 'sqmat:' + i, label: matLabel(x), act: 'i:sqMat', v: i, on: x === m, dis: ld })) });
          B.push({ label: 'Slot', row: TXS_SLOTS.map(k => ({ id: 'sqslot:' + k, label: SLOT_NAME[k], act: 'i:sqSlot', v: k, on: P.slot === k, dis: ld })) });
          const pics = scenePictures(), row = p => ({ id: 'sqpic:' + p, label: baseName(p), sub: dirOf(p) || 'the scene\'s top', act: 'i:sqPic', v: p, on: P.file === p, dis: ld });
          B.push({ row: [{ id: 'sqpic:own', label: 'Its own picture back', act: 'i:sqPic', v: '', on: P.file === '', dis: ld }] });
          if (pics.length) sqPaged(B, `Pick a picture (${pics.length})`, pics.map(row), P.ppage, 'sqPPg'); else B.push({ p: 'The scene has no pictures: put some in its folder.', c: 'faint' });
        }
      }
      B.push({ label: `At ${P.at.toFixed(2)} s`, row: NUDGES.map(d => ({ id: 'sqat:' + d, label: (d > 0 ? '+' : '−') + Math.abs(d), act: 'i:sqAtD', v: d, dis: ld })).concat([{ id: 'sqat:now', label: 'Preview time', act: 'i:sqAtNow', dis: ld }]) },
        { page: true, range: { id: 'stuRangeSqAt', act: 'sq:at', min: 0, max: Math.round(r.len * 10), step: 1, value: Math.min(Math.round(r.len * 10), Math.round(P.at * 10)), out: P.at.toFixed(1) + ' s', fmt: 's', aria: 'Where in the sequence, in seconds' } });
      B.push({ kv: [['It will', sqSentence(P)]] });
      const ok = !!sqNormOne(sqDraft(P), q.id) && (P.what !== 'tex' || (P.file !== null && ms0(t).length > 0));
      B.push({ row: [{ id: 'sqdo', label: 'Add', act: 'i:sqAdd', primary: true, dis: ld || !ok || full }] });
    }
  }
  if (q.rec.ev.some(e => e.t > r.len)) B.push({ p: 'An event past the sequence\'s length is kept but never reached.', c: 'faint' });
  B.push({ p: 'A sequence plays for everyone at this circle at once, on the room\'s clock (or for each person, if set). What it shows or hides counts as a cube does: the one started last decides.', c: 'faint' });
  B.splice(1, 0, ...lockTop(q), ...lockBlocks(q, dis));
}
const ms0 = t => (t && t.model ? ctMats(t) : []);
const sqNormOne = (e, id) => normSeqEv([e], id)[0] || null;
const sqEvKey = e => [e.on, e.what, e.clip || '', e.how || '', e.fade || '', e.mat, e.slot, e.file].join('|');
const sqSet = (q, patch) => { if (q.kind === 'q' && !q.rec.locked) setRec(q.id, patch); };
Object.assign(ITEM_ACT, {
  sqLen: (q, d) => sqSet(q, { len: r2(Math.min(600, Math.max(0.1, q.rec.len + (+d || 0)))) }),
  sqLoop: (q, v) => sqSet(q, { loop: v === 'loop' ? 'loop' : undefined }),
  sqStart: (q, v) => sqSet(q, { start: v === 'open' ? 'open' : undefined }),
  sqSync: (q, v) => {
    if (q.kind !== 'q' || q.rec.locked || (v === 'own') === (q.rec.sync === 'own')) return;
    const base = seqBase(q);
    if (v === 'own') { STU.qr.delete(q.id); } else { STU.qOwn.delete(q.id); }
    void base;
    setRec(q.id, { sync: v === 'own' ? 'own' : undefined });
  },
  sqCol: (q, v) => { const c = typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null; if (c) sqSet(q, { col: c === SEQ_COL ? undefined : c }); },
  sqSel: (q, k) => { const e = q.rec.ev[+k]; if (!e) return; STU.qsel = +k; STU.flash = STU.items.has(e.on) ? { id: e.on, at: performance.now(), play: true } : null; seqPreview(q, Math.min(e.t, q.rec.len), false); },
  sqEvPg: (q, d) => { STU.qpage = Math.max(0, (STU.qpage || 0) + (+d || 0)); },
  // a nudge of an event's time: one Undo step, but several within 0.8 s on the same event merge into one
  sqNudge: (q, v) => {
    const [k, d] = String(v).split(':').map(Number), e = q.rec.ev[k];
    if (q.kind !== 'q' || q.rec.locked || !e || !fin(d)) return;
    const t = r2(Math.min(600, Math.max(0, e.t + d))), L = SEQ.nudge, now = performance.now();
    if (t === e.t) return;
    const merge = L && L.id === q.id && L.key === sqEvKey(e) && L.t === e.t && now - L.at < 800 && UNDO[UNDO.length - 1] === L.step;
    const ev = q.rec.ev.slice(); ev[k] = Object.assign({}, e, { t });
    const topBefore = UNDO[UNDO.length - 1];
    change(() => setRec(q.id, { ev }));
    const ne = q.rec.ev.find(x => sqEvKey(x) === sqEvKey(e) && x.t === t);
    if (merge && UNDO[UNDO.length - 1] !== topBefore) UNDO.pop();
    SEQ.nudge = { id: q.id, key: sqEvKey(e), t, at: now, step: UNDO[UNDO.length - 1] };
    STU.qsel = ne ? q.rec.ev.indexOf(ne) : STU.qsel;
  },
  sqDel: (q, k) => { if (q.kind !== 'q' || q.rec.locked) return; const ev = q.rec.ev.slice(); if (!(+k >= 0 && +k < ev.length)) return; ev.splice(+k, 1); setRec(q.id, { ev }); STU.qsel = -1; },
  sqPreview: q => { if (q.kind === 'q') seqPreviewToggle(q); },
  sqPreviewEnd: q => { if (STU.qprev && STU.qprev.id === q.id) STU.qprev = null; },
  // Add an event...: the pick is the cube's (STU.plp, with seq: true), so the scene's pointer, Escape and the other picks treat it alike
  sqPick: q => { if (q.kind === 'q' && !q.rec.locked) { STU.plp = STU.plp && STU.plp.id === q.id ? null : { id: q.id, seq: true, step: 'obj', on: '', what: '', clip: '', how: 'once', fade: '', at: STU.qprev && STU.qprev.id === q.id ? r2(seqPrevU(q)) : 0, mat: 0, slot: 'map', file: null, page: 0, cpage: 0, ppage: 0 }; STU.pick = null; STU.txp = null; } },
  sqOn: (q, id) => {
    const P = STU.plp, t = STU.items.get(id);
    if (!P || !P.seq || P.id !== q.id || !t || t.id === q.id) return;
    const o = seqOpts(t);
    if (!o.length) return;
    const f = o[0];
    Object.assign(P, { step: 'how', on: id, what: f.what, clip: f.clip || '', page: 0, cpage: 0, ppage: 0, how: 'once', fade: '', file: null, mat: Math.max(0, ms0(t).findIndex(x => x.pics.map)) });
  },
  sqBack: q => { if (STU.plp && STU.plp.seq && STU.plp.id === q.id) Object.assign(STU.plp, { step: 'obj', on: '', what: '', clip: '' }); },
  sqWhat: (q, v) => {
    const P = STU.plp, t = P && P.seq && P.id === q.id ? STU.items.get(P.on) : null;
    if (!t) return;
    const s = String(v), what = s.startsWith('clip:') ? 'clip' : s, clip = what === 'clip' ? s.slice(5) : '';
    if (!seqOpts(t).some(o => o.what === what && (what !== 'clip' || o.clip === clip))) return;
    P.what = what; P.clip = clip; P.file = null;
    if (!(SQ_HOWS[what] || []).includes(P.how)) P.how = 'once';
  },
  sqHow: (q, v) => { const P = STU.plp; if (P && P.seq && P.id === q.id && (SQ_HOWS[P.what] || []).includes(v)) P.how = v; },
  sqFade: (q, v) => { const P = STU.plp; if (P && P.seq && P.id === q.id) P.fade = v === 'cut' ? 'cut' : ''; },
  sqMat: (q, i) => { const P = STU.plp; if (P && P.seq && P.id === q.id) P.mat = Math.max(0, +i || 0); },
  sqSlot: (q, k) => { const P = STU.plp; if (P && P.seq && P.id === q.id && TXS_SLOTS.includes(k)) P.slot = k; },
  sqPic: (q, p) => { const P = STU.plp; if (P && P.seq && P.id === q.id && (p === '' || STU.fileMap.has(p))) P.file = p; },
  sqPg: (q, d) => { const P = STU.plp; if (P && P.seq) P.page = Math.max(0, P.page + (+d || 0)); },
  sqCPg: (q, d) => { const P = STU.plp; if (P && P.seq) P.cpage = Math.max(0, P.cpage + (+d || 0)); },
  sqPPg: (q, d) => { const P = STU.plp; if (P && P.seq) P.ppage = Math.max(0, P.ppage + (+d || 0)); },
  sqAtD: (q, d) => { const P = STU.plp; if (P && P.seq && P.id === q.id) P.at = r2(Math.min(600, Math.max(0, P.at + (+d || 0)))); },
  sqAtNow: q => { const P = STU.plp; if (P && P.seq && P.id === q.id) P.at = r2(Math.min(q.rec.len, seqPrevU(q))); },
  sqAdd: q => {
    const P = STU.plp;
    if (q.kind !== 'q' || q.rec.locked || !P || !P.seq || P.id !== q.id || P.step !== 'how' || !P.what) return;
    const e = sqNormOne(sqDraft(P), q.id);
    if (!e || (P.what === 'tex' && P.file === null) || q.rec.ev.length >= SEQ_EV_MAX || seqEvCount() >= SEQ_EV_SCENE) return;
    setRec(q.id, { ev: q.rec.ev.concat(e) });
    STU.qsel = q.rec.ev.findIndex(x => sqEvKey(x) === sqEvKey(e) && x.t === e.t);
    STU.plp = null;
  },
});
PANE_ONLY.push('sqSel', 'sqEvPg', 'sqPreview', 'sqPreviewEnd', 'sqPick', 'sqOn', 'sqBack', 'sqWhat', 'sqHow', 'sqFade', 'sqMat', 'sqSlot', 'sqPic', 'sqPg', 'sqCPg', 'sqPPg', 'sqAtD', 'sqAtNow', 'sqNudge');
// the page's slider for the time of an event being added (tenths of a second)
function seqAtSet(v, done) { const P = STU.plp; if (P && P.seq) { P.at = r2(Math.min(600, v / 10)); if (done) dirty(true); } }
// the transport, which anyone may press (a visitor too, editing or not), refused only while the circle's story is locked
const SEQ_ACT = {
  sqPlay: () => seqCard1('start'), sqStop: () => seqCard1('stop'), sqRewind: () => seqCard1('rewind'),
  sqPreview: () => { const q = STU.items.get(STU.sel); if (q && q.kind === 'q' && editOn()) seqPreviewToggle(q); },
  sqPreviewEnd: () => { const q = STU.items.get(STU.sel); if (q && STU.qprev && STU.qprev.id === q.id) STU.qprev = null; },
};
function seqCard1(cmd) {
  const q = STU.items.get(STU.sel);
  if (!q || q.kind !== 'q' || !seqCan()) return;
  if (STU.qprev && STU.qprev.id === q.id) STU.qprev = null;
  seqCmd(q.id, cmd, undefined, 'card');
}

// ------------------------------------------------------------ items --
function addSequence() {
  if (!canAdd('q')) return '';
  const id = newId();
  change(() => putItem(id, 'q', norm('q', { name: nameFor('Sequence') })));
  select(id);
  sfxAct('place', 'world', null);
  return id;
}
// a copy: its events, not playing; the events naming a deleted or copied item (the rest of Duplicate and Delete: e6_items.js)
function duplicateSequence(q) {
  if (!canAdd('q')) return '';
  const nid = newId();
  change(() => putItem(nid, 'q', norm('q', Object.assign({}, q.rec, { name: nameFor(q.rec.name.replace(/ \d+$/, '')), locked: undefined }), nid)));
  select(nid);
  sfxAct('place', 'world', null);
  return nid;
}
// an item's copy (Duplicate): beside each event on the original, in every sequence, one for the copy (at most 200)
function seqCopy(from, to) {
  for (const q of [...STU.items.values()]) {
    if (q.kind !== 'q' || !q.rec.ev.some(e => e.on === from)) continue;
    setRec(q.id, { ev: withCopies(q.rec.ev, e => (e.on === from ? to : ''), SEQ_EV_MAX) });
  }
}
// items deleted (in a change): the events naming them go
function seqDeleted(gone) {
  for (const q of [...STU.items.values()]) {
    if (q.kind !== 'q' || gone.has(q.id) || !q.rec.ev.some(e => gone.has(e.on))) continue;
    setRec(q.id, { ev: q.rec.ev.filter(e => !gone.has(e.on)) });
  }
}
const seqSub = r => `${r.len.toFixed(1)} s · ${r.ev.length} event${r.ev.length === 1 ? '' : 's'}`;
function seqSig() {
  const q = STU.items.get(STU.sel);
  if (!q || q.kind !== 'q') return '';
  const P = seqEff(q), U = seqU(q, P, behNow());
  // nothing that moves with the clock or a scrub: the bar is patched on its own strip, and the state line gives no seconds while it moves
  const pv = !!P && P.src === 'preview';
  return [P ? (pv ? 'pv|' + P.on : P.n + '|' + P.on + '|' + P.ts) : '', U && U.ended, U && U.playing, STU.qprev && STU.qprev.id === q.id, STU.qsel, STU.qpage, seqCan(), STU.plp && STU.plp.seq ? [STU.plp.step, STU.plp.on, STU.plp.what, STU.plp.clip, STU.plp.how, STU.plp.fade, STU.plp.at, STU.plp.mat, STU.plp.slot, STU.plp.file, STU.plp.page, STU.plp.cpage, STU.plp.ppage].join() : ''].join();
}
// for tests (STUDIO.seq(id), STUDIO.seqs())
function seqState(id) {
  const q = seqRec(id);
  if (!q) return null;
  const Tr = behNow(), P = seqEff(q, 0, Tr), U = seqU(q, P, Tr), shows = {}, runs = [];
  if (q.sc && q.sc.U) for (const e of q.rec.ev) if ((e.what === 'show' || e.what === 'hide') && e.t <= q.sc.U.u) shows[e.on] = e.what;
  for (const t of TRG.on) for (const k of PLAY_WHAT) { const R = t.tr && t.tr[k]; if (R && R.c === q) runs.push([t.id, k, R.e.clip || '', R.e.how, R.at, R.off]); }
  return { rec: q.rec, play: P ? { on: P.on, at: P.at, t: P.t, n: P.n, ts: P.ts, src: P.src } : { src: 'none' }, u: U ? U.u : 0, ended: !!(U && U.ended), cycle: U ? U.cyc : 0, shows,
    tex: (q.stx || []).map(x => [x.on, x.mat, x.slot, x.file]), runs, fired: q.sq ? q.sq.fired : 0, key: q.sq ? q.sq.key : '', playing: !!(U && U.playing) };
}
const seqStates = () => Object.fromEntries(seqQs().map(q => [q.id, seqState(q.id)]));

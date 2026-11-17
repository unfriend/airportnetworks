// ============================================================== LOOPS ON THE BEAT ==
// Movement and events locked to the room's beat (v158; the owner, 17 November 2026: a loop recorder, "movement for now, both
// clocks should be possible", then "also do the events"; tools/output/SPEC.md "v158" section 4 is the contract,
// tools/studio/SPEC.md "Loops on the beat" the studio's part). The room's beat is bt (e6u_send.js: written only by the output
// page, from MIDI clock, OSC or its own tempo), with bar, beats a bar, and at a downbeat.
// - A recorded path may carry sync: 'beat' and beats (1 to 256, both or neither): while the room has a beat its moment is
//   ((beatPos mod beats) / beats) × its length, so it loops exactly on the beat and stretches with the tempo (its play, speed
//   and start ignored meanwhile); without one, as before. A cube's start of it, a timeline's hold and Pause win, as ever.
//   Record on the beat (1, 2, 4 or 8 bars, only while the room has a beat) counts in to the next downbeat (a soft step at
//   the item on each beat), records from that downbeat exactly bars × bar beats, its samples taken by beat position, stops
//   itself at the end downbeat, joins the loop (its end bent onto its start, nothing cut) and writes its path with play
//   'loop', sync 'beat' and beats, its keys in seconds at the tempo at its end: one Undo step.
// - A sequence may carry beats (1 to 256): while the room has a beat its time runs locked to the bar, its start rounded down
//   to a downbeat (seqLock, seqUBeat). Its events gain press (an item pressed as if pressed: its do entries for everyone,
//   worked out alike on every device from the sequence's state, no stamp written; the output page hears press from nobody)
//   and send (only an item's send entries go out: the output page hears that event from nobody; nothing shown or hidden).
//   Record events (1, 2, 4 or 8 bars, a grid, overdub) records what happens on the room's shared sources over those bars
//   (a new press stamp, a person's walking in or out of a cube with sends or pointing at an item with sends, an outside
//   switch, another shared sequence started or stopped) as events quantised to the grid, its length those bars, looped and
//   started on the beat at the end downbeat.
// This device's own while it runs (LOOP.on): nothing is written until its end.
let loopClock = () => behNow();   // (the clock of the loops: the room's ms; the tests set their own, as recClock and trgClock)
const LOOP_BARS = [1, 2, 4, 8], LOOP_GRIDS = [[0.25, '1/16'], [0.5, '1/8'], [1, '1/4'], [0, 'Off']], SEQ_SENDS = ['enter', 'leave', 'hover', 'unhover'], LOOP_KINDS = ['press', 'send', 'show', 'hide', 'seq'];
const SEND_EV_WORD = { enter: 'walking in', leave: 'walking out', hover: 'pointing begins', unhover: 'pointing ends' };
const LOOP = { on: null, grid: store.get('studioLoopGrid') === null ? 0.25 : +store.get('studioLoopGrid'), over: store.get('studioLoopOver') === '1', note: '', noteId: '', log: [], seen: null };
if (!LOOP_GRIDS.some(g => g[0] === LOOP.grid)) LOOP.grid = 0.25;
const EPS = 1e-6;
// a time-based tolerance in beats (1.5 ms): room moments are rounded to whole ms, and a beat is not a whole number of ms at
// most tempos (128 bpm), so a moment on a downbeat may land up to a few thousandths of a beat before it
const tolB = () => Math.max(EPS, STU.bt ? 1.5 / beatMs() : 0);
// the next downbeat strictly after the room moment now, in beats since bt.at
const nextDownbeat = now => { const b = btBar(), p = beatPos(now); return (Math.floor(p / b + tolB()) + 1) * b; };
const beatMoment = p => STU.bt.at + p * beatMs();

// ------------------------------------------------------------------ paths --
// a path on the beat: its moment (s) now while the room has a beat, else null (as before)
function pathBeatS(P) {
  if (P.sync !== 'beat' || !STU.bt) return null;
  const D = pathLen(P), x = beatPos(loopClock()) / P.beats;
  return D > 0 ? (x - Math.floor(x)) * D : 0;
}
// a recording on the beat as it ends: its samples' times (seconds at the tempo it began at) turned into the tempo at its end
function recBeatEnd(R) {
  const B = R.beat;
  if (!B || B.done) return;
  B.done = true;
  const k = STU.bt ? (60 / STU.bt.bpm) / B.spb : 1;
  if (Math.abs(k - 1) > 1e-9) for (const s of R.S) s[0] *= k;
  B.spbEnd = B.spb * k;
}

// -------------------------------------------------------------- sequences --
// a sequence locked to the beat now: { sb (its start beat, a downbeat), at0 (that room moment), k (how much longer a second
// of it is than a second) } or null (no beats, no room beat, a preview, never started)
function seqLock(q, P) {
  if (!q.rec.beats || !STU.bt || !P || P.src === 'preview' || !(P.at > 0)) return null;
  const b = btBar(), sb = Math.floor(beatPos(P.at) / b + tolB()) * b, bm = beatMs();
  return { sb, at0: beatMoment(sb), k: (q.rec.beats * bm) / (q.rec.len * 1000) };
}
// seqU on the beat: its time ((beatPos - its start beat) mod beats) / beats × len; stopped where it stopped, in its cycle then
function seqUBeat(q, P, Tr, L) {
  const len = q.rec.len, loop = q.rec.loop === 'loop', B = q.rec.beats;
  let playing = !!P.on, u, cyc = 0, ended = false;
  if (playing) {
    const x = Math.max(0, (beatPos(Tr) - L.sb) / B);
    if (loop) { cyc = Math.floor(x + tolB()); u = Math.max(0, (x - cyc) * len); } else { u = x * len; if (u >= len) { u = len; ended = true; playing = false; } }
  } else {
    u = Math.min(len, Math.max(0, P.t));
    if (loop && P.ts >= P.at) cyc = Math.max(0, Math.floor((beatPos(P.ts) - L.sb) / B + tolB()));
  }
  return { u, cyc, playing, ended, at0: L.at0, k: L.k, stopAt: ended ? L.at0 + len * 1000 * L.k : P.ts };
}
// the room moment of a sequence's time t in cycle cyc (k: its seconds stretched on the beat, else 1)
const seqAt = (U, len, cyc, t) => U.at0 + (cyc * len + t) * 1000 * (U.k || 1);
// the events an item can be sent by: a cube's walking in and out, an item's pointing (its send entries for them)
const seqSendEvs = t => (!t ? [] : t.kind === 'c' ? ['enter', 'leave'] : PRESS_KINDS.includes(t.kind) && t.rec.press ? ['hover', 'unhover'] : []).filter(ev => sendEnds(t, ev) || sendHas(t, ev));
// a press event: the item's show and hide entries as sources from its moment (seqShowHide, latest first: D the targets decided)
function seqPressShowHide(q, e, since, S, H, D) {
  const t = STU.items.get(e.on), L = t && PRESS_KINDS.includes(t.kind) && t.rec.press && t.rec.press.do;
  if (!L) return;
  for (let j = L.length - 1; j >= 0; j--) {
    const d = L[j];
    if ((d.what !== 'show' && d.what !== 'hide') || D.has(d.on)) continue;
    D.add(d.on);
    const src = { id: q.id, since, cut: d.fade === 'cut' }, M = d.what === 'show' ? S : H;
    if (enteredLater(src, M.get(d.on))) M.set(d.on, src);
  }
}
// a press event crossed (seqFire): the item's run entries started as the sequence's own runs (they come off as it stops, as
// its events' do); never its seq entries (a shared sequence is written by one device: a sequence's own seq events do that)
function seqPressRuns(q, e, i, cyc, T) {
  const t = STU.items.get(e.on), L = t && PRESS_KINDS.includes(t.kind) && t.rec.press && t.rec.press.do;
  if (!L) return;
  L.forEach((d, j) => {
    if (!SEQ_RUN.includes(d.what)) return;
    const x = STU.items.get(d.on);
    if (!x || !PLAY_KINDS[d.what].includes(x.kind)) return;
    SEQ.fired++;
    trgStart({ c: q, e: d, ek: q.id + '|' + i + '|' + cyc + '|p' + j, src: 'seq' }, T, false);
  });
}
// the output page's side (outStep): a shared sequence's press and send events crossed in real time (each cycle of a loop),
// from nobody; o its last frame's { key, playing, u, cyc }
function seqOutEvents(q, o, U, P, key) {
  if (!U || !U.playing || !o) return;
  const evs = q.rec.ev.filter(e => e.what === 'press' || e.what === 'send'), len = q.rec.len;
  if (!evs.length) return;
  const cross = (cyc, lo, hi) => {
    for (const e of evs) {
      if (e.t <= lo || e.t > hi) continue;
      const t = STU.items.get(e.on), m = seqAt(U, len, cyc, e.t);
      if (!t) continue;
      if (e.what === 'press') { if (PRESS_KINDS.includes(t.kind) && t.rec.press) outEmit(t, 'press', '', m); }
      else if (sendKind(t) && SEND_ONS[sendKind(t)].includes(e.ev)) outEmit(t, e.ev, '', m);
    }
  };
  // (a start just now: what it passed since it started, in real time; not what lies between its downbeat and its start)
  if (!o.playing || o.key !== key) { if (behNow() - P.at <= 250) cross(U.cyc, (P.at - seqAt(U, len, U.cyc, 0)) / 1000 / (U.k || 1) - 1e-6, U.u); return; }
  if (U.cyc === o.cyc) cross(U.cyc, o.u, U.u);
  else if (U.cyc === o.cyc + 1) { cross(o.cyc, o.u, len); cross(U.cyc, -1, U.u); }
}

// ------------------------------------------------------------- recording --
// LOOP.on: { kind: 'path' | 'seq', id, bars, bar, beats, from, to (beats since bt.at: its first and end downbeats), phase
// ('count' | 'rec'), tick (the last count-in beat sounded), got, by, caps (the shared sources' last values: seq), evs }
const loopWhy = (it, kind) => {
  if (!STU.bt) return 'needs the room\'s beat (output page)';
  if (!editOn()) return 'Turn on Edit to record.';
  if (LOOP.on) return 'Another loop is being recorded here.';
  if (kind === 'path') return recWhy(it);
  return it.rec.locked ? 'It is locked.' : '';
};
const loopSay = (id, text) => { LOOP.noteId = id; LOOP.note = text || ''; dirty(true); };
function loopArm(it, kind, bars) {
  if (!LOOP_BARS.includes(bars)) return false;
  const why = loopWhy(it, kind);
  if (why) { loopSay(it.id, why); return false; }
  const now = loopClock(), bar = btBar(), from = nextDownbeat(now);
  LOOP.on = { kind, id: it.id, bars, bar, beats: bars * bar, from, to: from + bars * bar, phase: 'count', tick: Math.floor(beatPos(now) + tolB()), got: 0, evs: [], caps: kind === 'seq' ? loopCaps() : null };
  loopSay(it.id, '');
  LOOP.log.push(['arm', kind, it.id, bars, from]); if (LOOP.log.length > 50) LOOP.log.shift();
  return true;
}
function loopCancel(why) {
  const L = LOOP.on;
  if (!L) return;
  LOOP.on = null;
  if (L.kind === 'path' && REC && REC.beat && REC.id === L.id) recEnd(false);
  LOOP.log.push(['cancel', L.kind, L.id, why || '']);
  loopSay(L.id, why === 'beat' ? 'The room\'s beat stopped: nothing recorded.' : 'Cancelled: nothing recorded.');
}
// each frame (itemsStep, before recStep): the count-in (a soft step at the item on each beat), the recording begun at its
// first downbeat, ended at its end downbeat
function loopStep() {
  const L = LOOP.on;
  if (!L) return;
  const it = STU.items.get(L.id);
  if (!it || !editOn()) { loopCancel('gone'); return; }
  if (!STU.bt) { loopCancel('beat'); return; }
  const now = loopClock(), p = beatPos(now);
  if (L.kind === 'seq') loopSeen(now);
  if (L.phase === 'count') {
    const b = Math.floor(p + tolB());
    if (b > L.tick && p < L.from - tolB()) { L.tick = b; sfxAct('step', 'world', it.holder ? it.holder.getWorldPosition(new THREE.Vector3()).toArray() : null, { force: true }); dirty(); }
    if (p < L.from - tolB()) return;
    L.phase = 'rec'; L.spb = 60 / STU.bt.bpm;
    if (L.kind === 'path') {
      const by = XR.on ? 'beat' : 'page';
      if (by === 'page') beginChange([it.id]);
      if (!recBegin(it, by)) { if (by === 'page') endChange(); LOOP.on = null; return; }
      REC.beat = { from: L.from, beats: L.beats, spb: L.spb };
      REC.last = -1e9; REC.S.length = 0; recSample(true); REC.S[0][0] = 0;   // (its first sample at the downbeat itself: t 0)
      L.by = by;
    }
    sfxAct('pulse', 'world', null, { gain: 0.5 });
    LOOP.log.push(['rec', L.kind, L.id, L.from]);
    dirty(true);
  }
  if (L.kind === 'path') {
    if (!REC || !REC.beat || REC.id !== L.id) { LOOP.on = null; return; }   // (ended otherwise: Cancel, the item gone)
    L.got = REC.S.length;
    if (p < L.to - tolB()) return;
    LOOP.on = null;
    REC.last = -1e9;
    if (L.by === 'page') recEnd(true); else change(() => recEnd(true), [L.id]);
    LOOP.log.push(['end', 'path', L.id, L.to]);
    return;
  }
  L.got = L.evs.length;
  if (p < L.to - tolB()) return;
  LOOP.on = null;
  loopSeqEnd(it, L);
}

// ---------------------------------------------------- events on shared sources --
// the shared sources' values now (a press stamp, an outside switch, another shared sequence's state): what is new since is
// an event (loopSeen)
function loopCaps() {
  const C = { pr: new Map(), sw: new Map(), qr: new Map() };
  for (const [id, v] of STU.pr) C.pr.set(id, v.n + '|' + v.at);
  for (const [id, v] of STU.sw) C.sw.set(id, v.on + '|' + v.at);
  for (const [id, v] of STU.qr) C.qr.set(id, v);
  return C;
}
function loopSeen() {
  const L = LOOP.on, C = L.caps;
  for (const [id, v] of STU.pr) {
    const k = v.n + '|' + v.at;
    if (C.pr.get(id) === k) continue;
    C.pr.set(id, k);
    const t = STU.items.get(id);
    if (t && PRESS_KINDS.includes(t.kind) && t.rec.press) loopGot({ on: id, what: 'press' }, v.at);
  }
  for (const [id, v] of STU.sw) {
    const k = v.on + '|' + v.at;
    if (C.sw.get(id) === k) continue;
    C.sw.set(id, k);
    if (STU.items.has(id)) loopGot({ on: id, what: v.on ? 'show' : 'hide' }, v.at);
  }
  for (const [id, v] of STU.qr) {
    const o = C.qr.get(id);
    if (o === v) continue;
    C.qr.set(id, v);
    if (id === L.id || !seqRec(id) || seqRec(id).rec.sync === 'own' || (o && o.n === v.n && o.on === v.on && o.at === v.at && o.ts === v.ts)) continue;
    if (v.on && (!o || !o.on || o.at !== v.at)) loopGot({ on: id, what: 'seq', how: 'once' }, v.at);
    else if (!v.on && v.t >= 0 && o && o.on) loopGot({ on: id, what: 'seq', how: 'stop' }, v.ts);
  }
}
// a send heard (the effect from a person's device, or this device's own: sendFx): walking in or out of a cube, pointing at an
// item, with send entries for it
function loopHeard(data) {
  const L = LOOP.on;
  if (!L || L.kind !== 'seq' || !data || data.try || !SEQ_SENDS.includes(data.ev) || !okId(data.id) || !fin(data.at)) return;
  const t = STU.items.get(data.id);
  if (t && seqSendEvs(t).includes(data.ev)) loopGot({ on: data.id, what: 'send', ev: data.ev }, data.at);
}
// one event at a room moment m: kept while the recording runs (counted in, it waits for the first downbeat), at its beat
// position since the first downbeat
function loopGot(e, m) {
  const L = LOOP.on;
  if (!L || L.phase !== 'rec' || !fin(m)) return;
  const rel = beatPos(m) - L.from;
  if (rel < -tolB() || rel >= L.beats - tolB()) return;
  L.evs.push(Object.assign({ b: Math.max(0, rel) }, e));
}
// the end: the events quantised to the grid (a position on the end downbeat goes round to the first), as seconds at the tempo
// then; overdub keeps the events it had, else those of the recorded kinds go; at most 200 (the rest dropped and said); its
// length the bars, beats, looped: one Undo step; then started on the beat at the end downbeat
function loopSeqEnd(q, L) {
  const spb = 60 / STU.bt.bpm, g = LOOP.grid, B = L.beats, seen = new Set(), add = [];
  for (const e of L.evs) {
    let b = g ? Math.round(e.b / g) * g : e.b;
    if (b >= B - tolB()) b -= B;
    const ev = { t: r2(Math.max(0, b) * spb), on: e.on, what: e.what };
    if (e.ev) ev.ev = e.ev;
    if (e.how) ev.how = e.how;
    const k = JSON.stringify(ev);
    if (seen.has(k)) continue;
    seen.add(k); add.push(ev);
  }
  const keep = LOOP.over ? q.rec.ev : q.rec.ev.filter(e => !LOOP_KINDS.includes(e.what)), room = Math.min(SEQ_EV_MAX - keep.length, SEQ_EV_SCENE - seqEvCount(q.id) - keep.length);
  const put = add.slice(0, Math.max(0, room)), lost = add.length - put.length, len = r2(Math.min(600, B * spb));
  change(() => setRec(q.id, { ev: keep.concat(put), len, beats: B, loop: 'loop' }));
  seqCmd(q.id, 'start', Math.round(beatMoment(L.to)), 'loop');
  LOOP.log.push(['end', 'seq', q.id, L.to, put.length, lost]);
  loopSay(q.id, `Recorded ${put.length} event${put.length === 1 ? '' : 's'} over ${L.bars} bar${L.bars > 1 ? 's' : ''}` + (lost ? `; ${lost} more dropped (a sequence takes ${SEQ_EV_MAX}).` : '.') + (add.length ? '' : ' Nothing happened on the room\'s presses, cubes, switches or sequences meanwhile.'));
}

// --------------------------------------------------------------- the cards --
const loopMine = (it, kind) => (LOOP.on && LOOP.on.id === it.id && LOOP.on.kind === kind ? LOOP.on : null);
function loopStatus(it, kind, B) {
  const L = loopMine(it, kind);
  if (L) {
    const p = beatPos(loopClock()) || 0;
    if (L.phase === 'count') B.push({ p: `Counting in: in ${Math.max(1, Math.ceil(L.from - p - tolB()))}`, c: 'amber' });
    else B.push({ p: `● Recording on the beat: bar ${Math.min(L.bars, Math.floor((p - L.from) / L.bar) + 1)} of ${L.bars}` + (kind === 'seq' ? `, ${L.evs.length} event${L.evs.length === 1 ? '' : 's'}` : ''), c: 'red' });
    B.push({ row: [{ id: 'lpcancel', label: 'Cancel', act: 'i:lpCancel' }] });
  }
  if (LOOP.noteId === it.id && LOOP.note) B.push({ p: LOOP.note, c: 'muted' });
}
const beatsWords = n => `${n} beat${n === 1 ? '' : 's'}` + (n % btBar() === 0 ? ` (${n / btBar()} bar${n / btBar() === 1 ? '' : 's'})` : '');
// a path's rows (pathBlocks, after how it plays): On the beat, and Record on the beat
function pathBeatBlocks(it, B, dis, no) {
  const P = it.rec.path, bt = !!STU.bt;
  if (recording(it)) { if (REC.beat) loopStatus(it, 'path', B); return; }   // (an ordinary recording: its own rows; on the beat: where it is)
  if (P) {
    B.push({ label: 'On the beat' + (P.sync ? `: ${beatsWords(P.beats)}` : ': Off'), row: [{ id: 'pbeat:off', label: 'Off', act: 'i:pbeat', v: 'off', on: !P.sync, dis },
      { id: 'pbeat:-', label: '− a bar', act: 'i:pbeat', v: '-', dis: dis || !P.sync || P.beats <= 1 }, { id: 'pbeat:+', label: '+ a bar', act: 'i:pbeat', v: '+', dis: dis || (P.sync && P.beats >= 256) },
      { id: 'pbeat:fit', label: 'Fit', act: 'i:pbeat', v: 'fit', dis: dis || !bt }] });
    if (P.sync) B.push({ p: bt ? `It loops on the room's beat (${STU.bt.bpm} bpm): ${beatsWords(P.beats)} a loop, stretched with the tempo.` : 'Without the room\'s beat it plays as before.', c: 'faint' });
  }
  const L = loopMine(it, 'path');
  B.push({ label: 'Record on the beat', row: LOOP_BARS.map(n => ({ id: 'lprec:' + n, label: `${n} bar${n > 1 ? 's' : ''}`, act: 'i:lpRec', v: n, on: !!(L && L.bars === n), dis: dis || no || !bt || (!!LOOP.on && !L) })) });
  if (!bt) B.push({ p: 'Record on the beat needs the room\'s beat (output page).', c: 'faint' });
  else if (!L) B.push({ p: 'It counts in to the next downbeat, records exactly those bars and loops them on the beat.' + (XR.on ? ' Take it up with the grip before or as it starts.' : ' Move it with the arrows or its card\'s buttons meanwhile.'), c: 'faint' });
  loopStatus(it, 'path', B);
}
// a sequence's rows (after its card): On the beat, and Record events
function seqBeatBlocks(q, B, dis) {
  const r = q.rec, bt = !!STU.bt, L = loopMine(q, 'seq');
  B.push({ label: 'On the beat' + (r.beats ? `: ${beatsWords(r.beats)}` : ': Off'), row: [{ id: 'qbeat:off', label: 'Off', act: 'i:qbeat', v: 'off', on: !r.beats, dis },
    { id: 'qbeat:-', label: '− a bar', act: 'i:qbeat', v: '-', dis: dis || !r.beats || r.beats <= 1 }, { id: 'qbeat:+', label: '+ a bar', act: 'i:qbeat', v: '+', dis: dis || r.beats >= 256 },
    { id: 'qbeat:fit', label: 'Fit', act: 'i:qbeat', v: 'fit', dis: dis || !bt }] });
  if (r.beats) B.push({ p: bt ? `Its ${r.len.toFixed(1)} s run as ${beatsWords(r.beats)} of the room's beat (${STU.bt.bpm} bpm), its start on a downbeat.` : 'Without the room\'s beat it plays as before.', c: 'faint' });
  B.push({ label: 'Record events', row: LOOP_BARS.map(n => ({ id: 'lpev:' + n, label: `${n} bar${n > 1 ? 's' : ''}`, act: 'i:lpEv', v: n, on: !!(L && L.bars === n), dis: dis || !bt || (!!LOOP.on && !L) })) },
    { label: 'Grid', row: LOOP_GRIDS.map(([g, l]) => ({ id: 'lpgrid:' + g, label: l, act: 'i:lpGrid', v: g, on: LOOP.grid === g })) },
    { label: 'Overdub', row: [{ id: 'lpover:off', label: 'Off', act: 'i:lpOver', v: 'off', on: !LOOP.over }, { id: 'lpover:on', label: 'On', act: 'i:lpOver', v: 'on', on: LOOP.over }] });
  B.push({ p: bt ? 'It counts in to the next downbeat and records what happens meanwhile on the room\'s presses, cubes with sends, outside switches and sequences, from any device, as events on the grid; then it loops them on the beat. Overdub keeps the events it has; off, the presses, sends, shows, hides and sequences it had go.' : 'Record events needs the room\'s beat (output page).', c: 'faint' });
  loopStatus(q, 'seq', B);
}
// beats one bar more or less, or the whole bars nearest its length at the tempo now (at least one)
function beatsStep(n, len, v) {
  const b = btBar();
  if (v === 'fit') return STU.bt ? Math.min(256, Math.max(1, Math.round(len / (b * beatMs() / 1000))) * b) : n;
  if (v === '+') return n ? Math.min(256, n + b) : STU.bt ? beatsStep(0, len, 'fit') : b;
  if (v === '-') return n ? Math.max(1, n - b) : 0;
  return 0;
}
Object.assign(ITEM_ACT, {
  pbeat: (it, v) => {
    const P = it.rec.path;
    if (!P) return;
    const n = v === 'off' ? 0 : beatsStep(P.sync ? P.beats : 0, pathLen(P), v);
    setRec(it.id, { path: normPath(Object.assign({}, P, n ? { sync: 'beat', beats: n } : { sync: undefined, beats: undefined })) || P });
  },
  qbeat: (q, v) => { if (q.kind !== 'q' || q.rec.locked) return; const n = v === 'off' ? 0 : beatsStep(q.rec.beats || 0, q.rec.len, v); setRec(q.id, { beats: n || undefined }); },
  lpRec: (it, v) => { const L = loopMine(it, 'path'); if (L) { loopCancel('card'); return; } loopArm(it, 'path', +v); },
  lpEv: (q, v) => { if (q.kind !== 'q') return; const L = loopMine(q, 'seq'); if (L) { loopCancel('card'); return; } loopArm(q, 'seq', +v); },
  lpCancel: () => loopCancel('card'),
  lpGrid: (it, v) => { const g = +v; if (LOOP_GRIDS.some(x => x[0] === g)) { LOOP.grid = g; store.set('studioLoopGrid', String(g)); } },
  lpOver: (it, v) => { LOOP.over = v === 'on'; store.set('studioLoopOver', LOOP.over ? '1' : null); },
});
PANE_ONLY.push('lpRec', 'lpEv', 'lpCancel', 'lpGrid', 'lpOver');
function loopSig() {
  const L = LOOP.on, p = L && STU.bt ? beatPos(loopClock()) : 0;
  return [L ? [L.id, L.kind, L.phase, L.bars, Math.floor(p + tolB()), L.evs.length].join() : '', LOOP.grid, LOOP.over, LOOP.note, STU.bt ? STU.bt.bpm + '/' + btBar() : ''].join('|');
}
// for tests: STUDIO.loops()
const loopState = () => { const L = LOOP.on; return { armed: !!L, phase: L ? L.phase : '', id: L ? L.id : '', kind: L ? L.kind : '', from: L ? L.from : 0, to: L ? L.to : 0, got: L ? L.got : 0, grid: LOOP.grid, over: LOOP.over, note: LOOP.note, log: LOOP.log.slice() }; };

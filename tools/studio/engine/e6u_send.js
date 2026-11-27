// ================================================= SENDS TO THE OUTPUT PAGE ==
// MIDI and OSC from the shared rooms and the studio (v157; the owner, 16 November 2026: "make it opt in by default and say
// who entered", "both" (MIDI and OSC), "in and out", "output page and then midi or local relay for osc and trackers";
// tools/output/SPEC.md is the contract, docs/agents/studio.md "Sends to the output page (MIDI and OSC)" the studio's part).
// A cube, a press record (an object's or a shape's) and a sequence may carry send entries (the scene's own mapping):
//   send: [{ on, t, osc, note, cc, val, ch, hold }]   (fields in this order, only those set; at most 8)
// on: a cube's 'enter' | 'leave' | 'on' | 'off'; a press's 'press' | 'hover' | 'unhover'; a sequence's 'start' | 'stop' |
// 'at' (t: its moment, s). osc: an address of its own (absent: the default, /studio/cube/<id>/<ev> ...). note or cc (never
// both): MIDI; val its value; ch 0 (by person) to 16 (absent: 1); hold: the note held (the controller at val) until the
// paired end. The output page (output.js, HOST.out) listens on HOST.cur.out and turns the events into MIDI and OSC.
// The exception to "a cube is each person's own" (the owner's decision): only for a cube opted in (its record has send
// entries), the fact that a person walked into it or out of it is sent as an ephemeral effect from that person's device
// (the effect 'send'); what the cube shows, hides, changes or starts for them stays their own and is never sent. Pointing
// at an item whose press has hover or unhover entries is sent likewise; nothing else of pointing is. Nothing goes into
// state() for either.
// The room's state also gains sw.<id> (an outside switch of an item, written only by the output page through act()) and bt
// (the room's beat, from the output page's MIDI clock or OSC), which a motion with a beat follows.
const SEND_MAX = 8, SEND_ONS = { c: ['enter', 'leave', 'on', 'off'], press: ['press', 'hover', 'unhover'], q: ['start', 'stop', 'at'] };
const SEND_HOLD = ['enter', 'on', 'hover', 'start'], SEND_PAIR = { enter: 'leave', on: 'off', hover: 'unhover', start: 'stop' };
const SEND_OSC = /^\/[A-Za-z0-9_.\-\/]{0,127}$/, SW_KINDS = ['o', 'p', 'e', 's', 'c'], BEATS = [0.25, 0.5, 1, 2, 4, 8, 16];
const SEND_RATE = 10, SEND_GAP = 100, OUT_RECENT = 2000;
Object.assign(STU, { sw: new Map(), bt: null, badSend: 0, sxp: null });
// this device's effects sent (out) and dropped (rate); its pointing and own cubes' edges; the output side's listeners and
// what they have seen (reset as the first listener comes, so nothing old is replayed)
const SENDS = { out: 0, dropped: 0, win: [], last: new Map(), hov: new Map(), log: [], spy: null };   // (spy: tests, in place of HOST.collab.effect)
const OUTL = { fns: [], said: new Set(), gen: -1, pr: new Map(), on: new Map(), q: new Map(), all: new Map(), log: [] };
const BEAT = { last: -1e9, pend: null, t: 0 };

// ---------------------------------------------------------------- the record --
// a list as a record keeps it (null: not a list). An entry that is not one is dropped (a field with a bad value, an on the
// record does not take, note and cc both, a hold where none can be); a field that does not apply is not written (t but for
// 'at', val and ch and hold without a note or a controller); an exact duplicate dropped; at most 8
function normSend(list, kind) {
  if (!Array.isArray(list)) return null;
  const out = [], seen = new Set(), ons = SEND_ONS[kind] || [];
  for (const e of list) {
    if (out.length >= SEND_MAX) break;
    if (!e || typeof e !== 'object' || Array.isArray(e) || !ons.includes(e.on)) continue;
    const has = k => e[k] !== undefined && e[k] !== null, int = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
    const r = { on: e.on };
    if (e.on === 'at') { if (!fin(e.t) || e.t < 0 || e.t > 600) continue; r.t = r2(e.t); }
    if (has('osc')) { if (typeof e.osc !== 'string' || !SEND_OSC.test(e.osc) || e.osc.includes('//')) continue; r.osc = e.osc; }
    if (has('note') && has('cc')) continue;
    if (has('note')) { if (!int(e.note, 0, 127)) continue; r.note = e.note; }
    if (has('cc')) { if (!int(e.cc, 0, 127)) continue; r.cc = e.cc; }
    const midi = has('note') || has('cc');
    if (has('val') && !int(e.val, 0, 127)) continue;
    if (has('ch') && !int(e.ch, 0, 16)) continue;
    if (has('hold') && typeof e.hold !== 'boolean') continue;
    if (e.hold === true && !(midi && SEND_HOLD.includes(e.on))) continue;
    if (midi && has('val')) r.val = e.val;
    if (midi && has('ch') && e.ch !== 1) r.ch = e.ch;
    if (e.hold === true) r.hold = true;
    const k = JSON.stringify(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}
// a list given for a record: kept only when it has an entry (else undefined); null a bad one (not a list)
const sendKeep = (x, kind) => { if (x == null) return undefined; const l = normSend(x, kind); return l === null ? null : l.length ? l : undefined; };
// the outside switch and the beat as the room keeps them (null: not one)
function normSw(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v) || (v.on !== 1 && v.on !== 0) || !fin(v.at) || v.at < 0) return null;
  return { on: v.on, at: Math.round(v.at), by: typeof v.by === 'string' ? v.by.slice(0, 32) : '' };
}
// (v158: bar, beats a bar, 1 to 16, with at a downbeat; written always from v158, kept as given: a bt without it, an older
// writer's, reads as 4 beats a bar with at a downbeat (btBar), and is given back as it was, so nothing is written back)
function normBt(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v) || !fin(v.bpm) || v.bpm < 20 || v.bpm > 300 || !fin(v.at) || v.at < 0) return null;
  if (v.bar !== undefined && v.bar !== null && !(Number.isInteger(v.bar) && v.bar >= 1 && v.bar <= 16)) return null;
  const r = { bpm: r2(v.bpm), at: Math.round(v.at) };
  if (v.bar != null) r.bar = v.bar;
  r.by = typeof v.by === 'string' ? v.by.slice(0, 32) : '';
  return r;
}
// the room's beat in numbers (v158; also on HOST.cur.out): beats a bar, a beat's ms, beats since its downbeat at the room
// moment now (may be less than 0), bars likewise; null without a beat
const btBar = () => (STU.bt && STU.bt.bar) || 4;
const beatMs = () => (STU.bt ? 60000 / STU.bt.bpm : null);
const beatPos = now => (STU.bt ? (now - STU.bt.at) / (60000 / STU.bt.bpm) : null);
const barPos = now => (STU.bt ? beatPos(now) / btBar() : null);
// an item's send list (a cube's or a sequence's own, a press's), and its kind of list ('' none can be)
const sendKind = it => (!it ? '' : it.kind === 'c' ? 'c' : it.kind === 'q' ? 'q' : PRESS_KINDS.includes(it.kind) ? 'press' : '');
const sendList = it => (!it ? [] : it.kind === 'c' || it.kind === 'q' ? it.rec.send || [] : PRESS_KINDS.includes(it.kind) && it.rec.press ? it.rec.press.send || [] : []);
// writes an item's list (an edit: the caller's change); an empty one takes it away
function sendWrite(it, L) {
  const k = sendKind(it);
  if (!k) return false;
  const list = L && L.length ? L : undefined;
  if (k === 'press') { if (!it.rec.press && !list) return true; pressSet(it, { send: list }); } else setRec(it.id, { send: list });
  return true;
}
const sendHas = (it, ev) => sendList(it).some(e => e.on === ev);
// an end to send (leave, off, unhover): an entry for it, or a held entry for its start (whose note or controller the output
// page lets go at this end: without it the note would sound until the person is gone)
const sendEnds = (it, ev) => sendList(it).some(e => e.on === ev || (e.hold === true && SEND_PAIR[e.on] === ev));
// the default OSC address of an item's event (Wire 4)
const sendAddr = (it, ev) => `/studio/${it.kind === 'c' ? 'cube' : it.kind === 'q' ? 'seq' : 'item'}/${it.id}/${ev}`;

// ------------------------------------------------------- the switch and the beat --
// sw as one more source in the cubes' rule (triggerStep, after the presses'): shows or hides from its moment, a 0.4 s fade (a
// cube switches at once), until a later source decides
const _swSrc = new Map();
function swShowHide(S, H) {
  if (!STU.sw.size) return;
  for (const [id, v] of STU.sw) {
    const it = STU.items.get(id);
    if (!it || !SW_KINDS.includes(it.kind)) continue;
    let s = _swSrc.get(id);
    if (!s) _swSrc.set(id, (s = { id: 'sw', sw: id, since: 0, cut: false }));
    s.since = v.at;
    const M = v.on ? S : H;
    if (enteredLater(s, M.get(id))) M.set(id, s);
  }
}
// a motion with a beat while the room has one: its moment (s) such that its cycle count is the beat's, else null
function motionBeatT(mo) {
  const B = STU.bt;
  if (!mo.beat || !B) return null;
  const c = Math.sign(mo.speed) * (behNow() - B.at) / (mo.beat * 60000 / B.bpm);
  return (c * 60) / mo.speed;
}

// -------------------------------------------------------- who and the effect --
const myId = () => { try { return (HOST.collab && HOST.collab.joined && String(HOST.collab.id || '').slice(0, 32)) || ''; } catch (e) { return ''; } };
const outPage = () => { try { return !!(HOST.collab && HOST.collab.outOn && HOST.collab.outOn()); } catch (e) { return false; } };
// a member id for a by: one already, or a member of that name (a press's and a sequence's by are names), else ''
function whoOf(by) {
  if (!by) return '';
  let M = [];
  try { M = (HOST.collab && HOST.collab.members) || []; } catch (e) { /* none */ }
  if (!Array.isArray(M)) M = [...(M.values ? M.values() : [])];
  if (M.some(m => m && m.id === by)) return by;
  const m = M.find(x => x && x.name === by);
  return m ? m.id : '';
}
// a person's device: in a room, not a camera, not the output page
const sendsHere = () => { if (SENDS.spy) return true; try { return !!(HOST.collab && HOST.collab.joined && HOST.collab.effect) && !camShows() && !outPage(); } catch (e) { return false; } };
// an effect 'send' from this device, rate limited (10 a second, one per item and event per 100 ms); the rest dropped and counted
function sendFx(data, quiet) {
  const now = trgClock(), k = data.id + '|' + data.ev;
  while (SENDS.win.length && now - SENDS.win[0] >= 1000) SENDS.win.shift();
  const L = SENDS.last.get(k);
  if (SENDS.win.length >= SEND_RATE || (L !== undefined && now - L < SEND_GAP)) { SENDS.dropped++; return false; }
  SENDS.win.push(now); SENDS.last.set(k, now);
  loopHeard(data);   // (this device's own walking in or pointing, while it records events on the beat: e6w_loops.js)
  SENDS.log.push([data.id, data.ev, data.at, data.try || 0]); if (SENDS.log.length > 100) SENDS.log.shift();
  // (the output page itself: its own listeners, as from itself; a person's device: the room)
  if (!SENDS.spy && (outPage() || !sendsHere())) { if (OUTL.fns.length) { SENDS.out++; studioEffect('send', data, myId()); return true; } return false; }
  let ok = false;
  try { ok = (SENDS.spy ? SENDS.spy('send', data, !!quiet) : HOST.collab.effect('send', data, !!quiet)) !== false; } catch (e) { ok = false; }
  if (ok) SENDS.out++;
  return ok;
}

// ------------------------------------------------------------ each frame --
// the end of triggerStep: this device's own cubes and pointing sent (a person's device), then what the output page works out
function sendStep(Tr) {
  if (sendsHere()) { sendCubes(Tr); sendPointing(Tr); }
  if (OUTL.fns.length) outStep(Tr);
}
// a cube that is each person's own with send entries: 'enter' as its inside becomes true here, 'leave' 0.3 s after it stops
// (back within that: nothing); a stay cube by the head itself
function sendCubes(Tr) {
  const now = trgClock();
  for (const c of SW.list) {
    if (!c.rec.send || c.rec.all || c.rec.key) { c.sd = null; continue; }
    const P = c.sd || (c.sd = { in: false, out: -1, outR: 0 });
    if (c.inside) {
      if (P.in) P.out = -1;
      else { P.in = true; P.out = -1; if (sendHas(c, 'enter')) sendFx({ id: c.id, ev: 'enter', at: Math.round(Tr) }); }
    } else if (P.in) {
      if (P.out < 0) { P.out = now; P.outR = Tr; }
      if (now - P.out >= PLAY_EDGE) { P.in = false; P.out = -1; if (sendEnds(c, 'leave')) sendFx({ id: c.id, ev: 'leave', at: Math.round(P.outR) }); }
    }
  }
}
// pointing (a real one: the card's Try pointing sends nothing) at an item whose press has hover or unhover entries: 'hover'
// as it begins, 'unhover' 0.3 s after it ends; quiet. Never for a press that is each person's own
function sendPointing(Tr) {
  if (PRESS.tryHov) return;
  const id = hoverNow(), now = trgClock(), H = SENDS.hov;
  for (const [k, h] of H) {
    if (k === id) { h.off = -1; continue; }
    if (h.off < 0) { h.off = now; h.offR = Tr; }
    if (now - h.off >= PLAY_EDGE) { H.delete(k); const it = STU.items.get(k); if (it && sendEnds(it, 'unhover') && !(it.rec.press && it.rec.press.who === 'own')) sendFx({ id: k, ev: 'unhover', at: Math.round(h.offR) }, true); }
  }
  if (id && !H.has(id)) {
    const it = STU.items.get(id);
    if (it && it.rec.press && it.rec.press.who !== 'own' && (sendHas(it, 'hover') || sendHas(it, 'unhover'))) {
      H.set(id, { off: -1, offR: 0 });
      if (sendHas(it, 'hover')) sendFx({ id, ev: 'hover', at: Math.round(Tr) }, true);
    }
  }
}

// ------------------------------------------------------- the output page's side --
// an event to the listeners: { ev, id, k, name, who, at, t?, send, try? }
function outEmit(it, ev, who, at, t, tr, x) {
  if (!OUTL.fns.length || !it) return;
  const send = sendList(it).filter(e => e.on === ev && (ev !== 'at' || e.t === t)).map(e => Object.assign({}, e));
  const o = { ev, id: it.id, k: it.kind, name: it.rec.name, who: who || '', at: Math.round(at) };
  if (ev === 'at') o.t = t;
  o.send = send;
  if (tr) o.try = 1;
  if (x) Object.assign(o, x);   // (a stream's Try, v158: its v and stream entries; e6v_stream.js)
  OUTL.log.push([ev, it.id, o.who, o.at]); if (OUTL.log.length > 100) OUTL.log.shift();
  for (const fn of OUTL.fns.slice()) {
    try { fn(Object.assign({}, o, { send: send.map(e => Object.assign({}, e)) })); } catch (e) { if (!OUTL.said.has(fn)) { OUTL.said.add(fn); try { console.warn('studio: an output listener failed', e); } catch (x) { /* no console */ } } }
  }
}
// the deciding source of a cube's switch, as a member id: an outside switch's by, a press stamp's, a sequence state's; '' else
function srcWho(w, Tr) {
  if (!w) return '';
  if (w.id === 'sw') { const v = STU.sw.get(w.sw); return v ? v.by : ''; }
  const t = STU.items.get(w.id);
  if (!t) return '';
  if (t.kind === 'q') { const P = seqEff(t, 0, Tr, true); return P ? whoOf(P.by) : ''; }
  if (PRESS_KINDS.includes(t.kind) && !w.hv) { const st = STU.pr.get(t.id); return st ? whoOf(st.by) : ''; }
  return '';
}
function outStep(Tr) {
  // (a new scene, or the first listener: what is there now is taken as seen; a press or a start within 2 s still goes out)
  const fresh = OUTL.gen !== STU.gen;
  if (fresh) { OUTL.gen = STU.gen; OUTL.on.clear(); OUTL.q.clear(); OUTL.all.clear(); OUTL.pr.clear(); }
  if (STU.listing !== 'ok') return;
  // presses: every new shared stamp, items with no send entries too, when its moment is within 2 s of now
  for (const [id, st] of STU.pr) {
    const key = st.n + '|' + st.at, it = STU.items.get(id);
    if (OUTL.pr.get(id) === key) continue;
    OUTL.pr.set(id, key);
    if (it && PRESS_KINDS.includes(it.kind) && Math.abs(Tr - st.at) <= OUT_RECENT) outEmit(it, 'press', whoOf(st.by), st.at);
  }
  for (const c of SW.list) {
    // cubes switched on or off as this device works it out (a cube with entries for them)
    const on = c.on !== false, was = OUTL.on.get(c.id);
    OUTL.on.set(c.id, on);
    if (was !== undefined && was !== on && sendEnds(c, on ? 'on' : 'off')) outEmit(c, on ? 'on' : 'off', srcWho(on ? c.onBy : c.offBy, Tr), c.rec.all || c.rec.key ? c.swAt || Tr : Tr);
    // an everyone cube and one with a key, worked out here from the heads (or its key): entered, left 0.3 s after
    if (!(c.rec.all || c.rec.key) || !c.rec.send) { OUTL.all.delete(c.id); continue; }
    let A = OUTL.all.get(c.id);
    if (!A) OUTL.all.set(c.id, (A = { in: false, out: -1, outR: 0, who: '', last: '' }));
    if (c.allIn && c.allIn.size) { let b = '', bt = Infinity; for (const [hid, ts] of c.allIn) if (ts < bt) { bt = ts; b = hid; } A.last = [...c.allIn.keys()].pop() || A.last; if (!A.in) A.who = b; }
    if (c.inside) {
      if (A.in) A.out = -1;
      else { A.in = true; A.out = -1; if (sendHas(c, 'enter')) outEmit(c, 'enter', c.rec.key ? '' : A.who, c.rec.all ? c.entAt : Tr); }
    } else if (A.in) {
      if (A.out < 0) { A.out = Tr; A.outR = c.rec.all ? c.lvAt : Tr; }
      if (Tr - A.out >= PLAY_EDGE) { A.in = false; A.out = -1; if (sendEnds(c, 'leave')) outEmit(c, 'leave', c.rec.key ? '' : A.last, A.outR); }
    }
  }
  // shared sequences: start and stop (with or without entries), and their 'at' entries crossed in real time
  for (const q of STU.items.values()) {
    if (q.kind !== 'q' || q.rec.sync === 'own') continue;
    const P = seqEff(q, 0, Tr, true), U = seqU(q, P, Tr), playing = !!(U && U.playing);
    const key = P ? [P.n, P.on, P.at, P.ts, P.src].join('|') : '', o = OUTL.q.get(q.id), who = P ? whoOf(P.by) : '';
    OUTL.q.set(q.id, { key, playing, u: U ? U.u : 0, cyc: U ? U.cyc : 0 });
    const ats = (q.rec.send || []).filter(e => e.on === 'at');
    const cross = (lo, hi) => { const done = new Set(); for (const e of ats) if (e.t > lo && e.t <= hi && !done.has(e.t)) { done.add(e.t); outEmit(q, 'at', who, seqAt(U, q.rec.len, U.cyc, e.t), e.t); } };
    seqOutEvents(q, o, U, P, key);   // (its press and send events crossed in real time, v158: e6w_loops.js)
    if (!o) { if (playing && Tr - P.at <= OUT_RECENT && !fresh) outEmit(q, 'start', who, P.at); continue; }
    const restart = playing && o.playing && key !== o.key && P.on;
    if (playing && (!o.playing || restart)) {
      if (Tr - P.at <= OUT_RECENT) outEmit(q, 'start', who, P.at);
      if (ats.length && Tr - P.at <= 250) cross(-1, U.u);   // (a start just now: what it has passed since, in real time)
    } else if (!playing && o.playing) {
      const m = U ? U.stopAt : P ? P.ts : Tr;
      if (Tr - m <= OUT_RECENT) outEmit(q, 'stop', who, m);
    } else if (playing && ats.length && key === o.key) {
      if (U.cyc === o.cyc) cross(o.u, U.u);
      else if (U.cyc === o.cyc + 1) { const c0 = U.cyc; U.cyc = o.cyc; cross(o.u, q.rec.len); U.cyc = c0; cross(-1, U.u); }
    }
  }
}

// -------------------------------------------------------------- effects in --
// the effect 'send' (studioEffect): ignored unless something listens here (the output page); a bad one ignored
function sendHeard(data, by) {
  if (!OUTL.fns.length || !data || typeof data !== 'object' || Array.isArray(data) || !okId(data.id) || typeof data.ev !== 'string' || !fin(data.at)) return;
  if (data.ev === 'stream') { streamHeard(data, by); return; }   // (a stream's Try, v158: e6v_stream.js)
  const it = STU.items.get(data.id), k = sendKind(it);
  if (!k || !SEND_ONS[k].includes(data.ev)) return;
  const tr = data.try === 1;
  // (from a person: a cube's enter and leave, pointing's hover and unhover; anything from a card's Try)
  if (!tr && !(k === 'c' && (data.ev === 'enter' || data.ev === 'leave')) && !(k === 'press' && (data.ev === 'hover' || data.ev === 'unhover'))) return;
  // (and only what the sender would send: an item that opted in to this event, a cube that is not everyone's or keyed, a
  // press that is not each person's own; a stale or changed client's is ignored)
  if (!tr && (!sendEnds(it, data.ev) || (k === 'c' && (it.rec.all || it.rec.key)) || (k === 'press' && !(it.rec.press && it.rec.press.who !== 'own')))) return;
  if (data.ev === 'at' && !fin(data.t)) return;
  outEmit(it, data.ev, typeof by === 'string' ? by.slice(0, 32) : '', data.at, data.ev === 'at' ? r2(data.t) : undefined, tr);
}

// ------------------------------------------------------------ the API (Wire 2) --
const outReady = () => !!(LOAD.done && STU.scene && STU.listing === 'ok');
const OUT_KINDS = ['o', 'p', 'e', 's', 'c', 'q'];
const _opM = new THREE.Matrix4(), _opP = new THREE.Vector3(), _opQ = new THREE.Quaternion(), _opS = new THREE.Vector3();
function outPose(id) {
  const it = STU.items.get(id);
  if (!it || it.kind === 'q' || !OUT_KINDS.includes(it.kind) || !it.holder) return null;
  try {
    it.holder.updateWorldMatrix(true, false);
    _opM.copy(GL.items.matrixWorld).invert().multiply(it.holder.matrixWorld).decompose(_opP, _opQ, _opS);
  } catch (e) { return null; }
  const r6 = v => Math.round(v * 1e6) / 1e6;
  return { p: _opP.toArray().map(r6), q: _opQ.toArray().map(r6), shown: !!it.shown && !it.notHere };
}
function outAct(a) {
  try {
    if (!a || typeof a !== 'object') return { ok: false, why: 'not an action' };
    if (!outReady()) return { ok: false, why: 'no scene' };
    const d = a.do, it = typeof a.id === 'string' ? STU.items.get(a.id) : null;
    if (d === 'press') {
      if (!it || !PRESS_KINDS.includes(it.kind)) return { ok: false, why: 'no such item' };
      const p = it.rec.press;
      if (!p) return { ok: false, why: 'it has no press' };
      if (p.who === 'own') return { ok: false, why: 'its press is each person\'s own' };
      if (!((p.do && p.do.length) || (p.send && p.send.length))) return { ok: false, why: 'nothing happens when it is pressed' };
      return pressFire(it.id) ? { ok: true } : { ok: false, why: 'pressed less than 250 ms ago' };
    }
    if (['start', 'stop', 'toggle', 'rewind'].includes(d)) {
      if (!it || it.kind !== 'q') return { ok: false, why: 'not a sequence' };
      if (it.rec.sync === 'own') return { ok: false, why: 'it plays for each person on their own' };
      if (editLocked()) return { ok: false, why: 'the circle\'s story is locked' };
      let cmd = d;
      if (d === 'toggle') { const Tr = behNow(), P = seqEff(it, 0, Tr, true), U = seqU(it, P, Tr); cmd = U && U.playing ? 'stop' : 'start'; }
      seqCmd(it.id, cmd, undefined, 'output');
      return { ok: true };
    }
    if (['show', 'hide', 'flip', 'clear'].includes(d)) {
      if (!it || !SW_KINDS.includes(it.kind)) return { ok: false, why: 'not an object, shape, empty, sound or cube' };
      if (d === 'clear') { if (STU.sw.delete(it.id)) dirty(); return { ok: true }; }
      const shown = it.kind === 'c' ? it.on !== false : !!it.shown, on = d === 'show' ? 1 : d === 'hide' ? 0 : shown ? 0 : 1;
      STU.sw.set(it.id, { on, at: Math.round(behNow()), by: myId() });
      dirty();
      return { ok: true };
    }
    if (d === 'beat') return beatAct(a.bpm, a.at, a.bar);
    return { ok: false, why: 'not an action' };
  } catch (e) { return { ok: false, why: 'failed: ' + (e && e.message) }; }
}
// the room's beat: written at most once a second (the last kept and written when the second is up), taken away at once
function beatAct(bpm, at, bar) {
  if (bpm === undefined || bpm === null || bpm === 0) {
    if (BEAT.t) { clearTimeout(BEAT.t); TIMERS.delete(BEAT.t); BEAT.t = 0; }
    BEAT.pend = null;
    if (STU.bt) { STU.bt = null; dirty(); }
    return { ok: true };
  }
  if (!fin(bpm) || bpm < 20 || bpm > 300) return { ok: false, why: 'the bpm is outside 20 to 300' };
  // (beats a bar, v158: absent the room's now, else 4; written always)
  if (bar !== undefined && bar !== null && !(Number.isInteger(bar) && bar >= 1 && bar <= 16)) return { ok: false, why: 'bar 1 to 16' };
  const b = bar != null ? bar : (BEAT.pend && BEAT.pend.bar) || btBar();
  BEAT.pend = { bpm: r2(bpm), at: Math.round(fin(at) && at >= 0 ? at : behNow()), bar: b, by: myId() };
  const wait = 1000 - (performance.now() - BEAT.last);
  if (wait <= 0) beatWrite();
  else if (!BEAT.t) BEAT.t = later(() => { BEAT.t = 0; beatWrite(); }, wait);
  return { ok: true };
}
function beatWrite() {
  if (!BEAT.pend) return;
  STU.bt = BEAT.pend; BEAT.pend = null; BEAT.last = performance.now();
  dirty();
}
const OUT_API = {
  v: 1,
  ready: () => outReady(),
  scene: () => STU.scene || '',
  list: () => [...STU.items.values()].filter(it => OUT_KINDS.includes(it.kind)).map(it => ({ id: it.id, k: it.kind, name: it.rec.name, send: sendList(it).map(e => Object.assign({}, e)),
    press: PRESS_KINDS.includes(it.kind) && it.rec.press ? (it.rec.press.who === 'own' ? 'own' : 'all') : '', all: it.kind === 'c' && !!it.rec.all, key: it.kind === 'c' && it.rec.key ? it.rec.key : '',
    stream: (it.rec.stream || []).map(e => Object.assign({}, e)) })),   // (its streams, v158: e6v_stream.js)
  pose: id => outPose(id),
  // (v158: an item's state value for its streams, null for the kinematic ones and where there is none; the beat in numbers)
  value: (id, v) => outValue(id, v),
  beatMs: () => beatMs(),
  beatPos: now => beatPos(now === undefined ? behNow() : now),
  barPos: now => barPos(now === undefined ? behNow() : now),
  listen(fn) {
    if (typeof fn !== 'function') return () => {};
    if (!OUTL.fns.length) OUTL.gen = -1;   // (the first listener: what is there now is taken as seen)
    OUTL.fns.push(fn);
    return () => { const i = OUTL.fns.indexOf(fn); if (i >= 0) OUTL.fns.splice(i, 1); };
  },
  act: a => outAct(a),
  beat: () => (STU.bt ? Object.assign({}, STU.bt, { bar: btBar() }) : null),   // (bar always given, v158)
  sends: () => ({ out: SENDS.out, dropped: SENDS.dropped }),
};

// -------------------------------------------------------------------- the cards --
const SX_ON_WORD = { enter: 'Walking in', leave: 'Walking out', on: 'Switched on', off: 'Switched off', press: 'When pressed', hover: 'As pointing begins', unhover: 'As pointing ends', start: 'At the start', stop: 'At the stop' };
const SX_HOLD_WORD = { enter: 'held while inside', on: 'held while switched on', hover: 'held while pointed at', start: 'held while it plays' };
const SX_HOLD_TILL = { enter: 'Hold until they walk out', on: 'Hold until it is switched off', hover: 'Hold until pointing ends', start: 'Hold until it stops' };
const sxOnWord = e => (e.on === 'at' ? `At ${(e.t || 0).toFixed(2)} s` : SX_ON_WORD[e.on] || e.on);
const sxChWord = e => (e.ch === 0 ? 'channel by person' : `channel ${e.ch === undefined ? 1 : e.ch}`);
function sxMidiWords(e) {
  if (e.note === undefined && e.cc === undefined) return 'no MIDI';
  const n = e.note !== undefined ? `note ${e.note}` : `controller ${e.cc}`, dv = e.note !== undefined ? 100 : 127;
  return n + (e.val !== undefined && e.val !== dv ? `, value ${e.val}` : '') + ', ' + sxChWord(e) + (e.hold ? ', ' + SX_HOLD_WORD[e.on] : '');
}
// an entry in words: "Walking in · OSC /studio/cube/ab12cd/enter · note 36, channel 1, held while inside"
const sxWords = (it, e) => `${sxOnWord(e)} · OSC ${e.osc || sendAddr(it, e.on)} · ${sxMidiWords(e)}`;
// the draft as an entry, checked (null: not one)
function sxDraft(P) {
  const e = { on: P.on };
  if (P.on === 'at') e.t = P.t;
  if (P.osc) e.osc = P.osc;
  if (P.midi === 'note') e.note = P.n; else if (P.midi === 'cc') e.cc = P.n;
  if (P.midi !== 'none') { if (P.val !== (P.midi === 'note' ? 100 : 127)) e.val = P.val; e.ch = P.ch; if (P.hold && SEND_HOLD.includes(P.on)) e.hold = true; }
  return normSend([e], P.kind)[0] || null;
}
function sxSentence(it, P) {
  const d = sxDraft(P);
  if (!d) return P.osc && !SEND_OSC.test(P.osc) ? 'Not an OSC address: it starts with / and has letters, digits and _ . - / only.' : 'Not one the scene can keep.';
  const lead = { enter: 'As someone walks in', leave: 'As someone walks out', on: 'As it is switched on', off: 'As it is switched off', press: 'When it is pressed', hover: 'As someone points at it', unhover: 'As someone stops pointing at it', start: 'As it starts', stop: 'As it stops' }[d.on] || `As it passes ${(d.t || 0).toFixed(2)} s`;
  const osc = `the output page sends OSC ${d.osc || sendAddr(it, d.on)}`;
  if (d.note === undefined && d.cc === undefined) return `${lead}, ${osc}.`;
  const ch = d.ch === 0 ? 'on the channel of who did it' : `on channel ${d.ch === undefined ? 1 : d.ch}`;
  const m = d.note !== undefined ? `MIDI note ${d.note} (velocity ${d.val === undefined ? 100 : d.val}) ${ch}` + (d.hold ? `, held until ${{ enter: 'they walk out', on: 'it is switched off', hover: 'the pointing ends', start: 'it stops' }[d.on]}` : '')
    : `MIDI controller ${d.cc} at ${d.val === undefined ? 127 : d.val} ${ch}` + (d.hold ? `, back to 0 ${{ enter: 'as they walk out', on: 'as it is switched off', hover: 'as the pointing ends', start: 'as it stops' }[d.on]}` : '');
  return `${lead}, ${osc} and ${m}.`;
}
const SX_PARA = { c: 'Only that someone walked in or out goes to the room (with their name and colour); what the cube shows stays each person\'s own.',
  press: 'A press goes to the output page as the room\'s press stamp; pointing (with As pointing begins or ends) as a message from the device pointing. Sent only by MIDI and OSC from the output page (Shared: Output page).',
  q: 'Its start and stop go to the output page from the room\'s play state; At ... s as it passes that moment while it plays.' };
// the Sends rows: one per entry (a press opens it to change; Try sends it once; ✕ takes it away), and Add a send...
function sendBlocks(it, B, dis) {
  const kind = sendKind(it), L = sendList(it), P = STU.sxp && STU.sxp.id === it.id ? STU.sxp : null, full = L.length >= SEND_MAX;
  if (!kind) return;
  if (kind === 'c') {
    B.push({ label: 'Sends to the output page', row: [{ id: 'sxon:off', label: 'Off', act: 'i:sxOn', v: 'off', on: !L.length, dis }, { id: 'sxon:on', label: 'On', act: 'i:sxOn', v: 'on', on: !!L.length, dis }] });
    B.push({ p: SX_PARA.c, c: 'faint' });
    if (it.rec.all || it.rec.key) B.push({ p: it.rec.key ? 'It reacts to its key: the output page works out its walking in and out itself, from nobody.' : 'For everyone here: the output page works out its walking in and out itself, from the heads it sees.', c: 'faint' });
    if (!L.length && !P) return;
  } else B.push({ label: L.length ? `Sends (${L.length})` : 'Sends' });
  const own = kind === 'press' ? it.rec.press && it.rec.press.who === 'own' : kind === 'q' && it.rec.sync === 'own';
  if (own) B.push({ p: kind === 'press' ? 'Its press is each person\'s own: its sends never reach the output page.' : 'It plays for each person on their own: its sends never reach the output page.', c: 'amber' });
  if (!L.length && kind !== 'c') B.push({ p: 'Nothing goes to the output page (MIDI and OSC)' + (kind === 'press' ? ' but the press itself, on its default address when the page sends every press.' : ' but its start and stop, on their default addresses when the page sends every sequence.'), c: 'faint' });
  L.forEach((e, k) => B.push({ row: [
    { id: `sxe:${k}`, label: sxWords(it, e), act: 'i:sxEdit', v: k, on: !!(P && P.idx === k) },
    { id: `sxtry:${k}`, label: 'Try', act: 'i:sxTry', v: k },
    { id: `sxx:${k}`, label: '✕', act: 'i:sxDel', v: k, dis, col: 'red' }] }));
  B.push({ row: [{ id: 'sxadd', label: P ? 'Cancel' : 'Add a send...', act: 'i:sxPick', on: !!P, dis: dis || (!P && full) }] });
  if (full) B.push({ p: `${SEND_MAX} sends: the most one list takes.`, c: 'amber' });
  if (P) sxPickBlocks(it, B, dis, P);
  if (kind !== 'c') B.push({ p: SX_PARA[kind], c: 'faint' });
}
function sxPickBlocks(it, B, dis, P) {
  const ons = SEND_ONS[P.kind];
  B.push({ label: 'When', row: ons.map(o => ({ id: 'sxwhen:' + o, label: o === 'at' ? 'At ... s' : SX_ON_WORD[o], act: 'i:sxWhen', v: o, on: P.on === o, dis })) });
  if (P.on === 'at') B.push({ label: `At ${P.t.toFixed(2)} s`, row: NUDGES.map(d => ({ id: 'sxat:' + d, label: (d > 0 ? '+' : '−') + Math.abs(d), act: 'i:sxAt', v: d, dis })) });
  B.push({ label: 'MIDI', row: [['none', 'None'], ['note', 'Note'], ['cc', 'Controller']].map(([v, l]) => ({ id: 'sxmidi:' + v, label: l, act: 'i:sxMidi', v, on: P.midi === v, dis })) });
  if (P.midi !== 'none') {
    const nm = P.midi === 'note' ? 'Note' : 'Controller';
    B.push({ label: `${nm}: ${P.n}`, row: [-12, -1, 1, 12].map(d => ({ id: 'sxn:' + d, label: (d > 0 ? '+' : '−') + Math.abs(d), act: 'i:sxN', v: d, dis })) },
      { page: true, label: `${nm} number (0 to 127)`, input: { id: 'stuSendNum', value: String(P.n), ph: '0 to 127', max: 3, aria: 'The number, 0 to 127' }, row: [] },
      { label: `${P.midi === 'note' ? 'Velocity' : 'Value'}: ${P.val}`, row: [-10, -1, 1, 10].map(d => ({ id: 'sxv:' + d, label: (d > 0 ? '+' : '−') + Math.abs(d), act: 'i:sxV', v: d, dis })) },
      { label: `Channel: ${P.ch === 0 ? 'by person' : P.ch}`, row: [{ id: 'sxch:-', label: '−1', act: 'i:sxCh', v: -1, dis: dis || P.ch <= 1 }, { id: 'sxch:+', label: '+1', act: 'i:sxCh', v: 1, dis: dis || P.ch === 0 || P.ch >= 16 },
        { id: 'sxch:1', label: '1', act: 'i:sxCh', v: 'one', on: P.ch === 1, dis }, { id: 'sxch:0', label: 'By person', act: 'i:sxCh', v: 'person', on: P.ch === 0, dis }] });
    if (SEND_HOLD.includes(P.on)) B.push({ label: SX_HOLD_TILL[P.on], row: [{ id: 'sxhold:off', label: 'Off', act: 'i:sxHold', v: 'off', on: !P.hold, dis }, { id: 'sxhold:on', label: 'On', act: 'i:sxHold', v: 'on', on: !!P.hold, dis }] });
  }
  const own = P.osc || '';
  B.push({ kv: [['OSC', own ? `its own address ${own}` : `the default address ${sendAddr(it, P.on)}`]] });
  B.push({ page: true, label: 'OSC address of its own (empty: the default)', input: { id: 'stuSendOsc', value: P.oscText === undefined ? own : P.oscText, ph: sendAddr(it, P.on), max: 128, aria: 'Its own OSC address' }, row: [{ id: 'sxosc', label: 'Use it', act: 'i:sxOsc', v: '', dis }] });
  if (P.oscBad) B.push({ page: true, p: 'Not an OSC address: it starts with / and has letters, digits and _ . - / only (no //).', c: 'amber' });
  B.push({ xr: true, row: [{ id: 'sxosc:def', label: 'Default address', act: 'i:sxOscX', v: '', on: !own, dis }].concat(P.osc0 ? [{ id: 'sxosc:own', label: 'Its own: ' + P.osc0, act: 'i:sxOscX', v: 'own', on: own === P.osc0, dis }] : []) });
  B.push({ kv: [['It will', sxSentence(it, P)]] });
  const d = sxDraft(P), L = sendList(it), rep = P.idx >= 0 && P.idx < L.length;
  B.push({ row: [{ id: 'sxdo', label: rep ? 'Replace' : 'Add', act: 'i:sxAdd', primary: true, dis: dis || !d || (!rep && L.length >= SEND_MAX) }] });
}
const sxNew = (it, e, idx) => {
  const kind = sendKind(it), midi = e && e.note !== undefined ? 'note' : e && e.cc !== undefined ? 'cc' : 'none';
  return { id: it.id, kind, idx, on: e ? e.on : SEND_ONS[kind][0], t: e && e.on === 'at' ? e.t : 0, midi, n: e ? (midi === 'note' ? e.note : midi === 'cc' ? e.cc : 60) : 60,
    val: e && e.val !== undefined ? e.val : midi === 'cc' ? 127 : 100, ch: e && e.ch !== undefined ? e.ch : 1, hold: !!(e && e.hold), osc: (e && e.osc) || '', osc0: (e && e.osc) || '', oscText: undefined, oscBad: false };
};
const sxP = it => (STU.sxp && STU.sxp.id === it.id ? STU.sxp : null);
const clampI = (v, a, b) => Math.min(b, Math.max(a, Math.round(v)));
Object.assign(ITEM_ACT, {
  // Sends to the output page (a cube): On adds walking in and out (default addresses, no MIDI), Off takes the list away
  sxOn: (c, v) => { if (c.kind !== 'c') return; if (v === 'on') { if (!(c.rec.send && c.rec.send.length)) setRec(c.id, { send: [{ on: 'enter' }, { on: 'leave' }] }); } else { setRec(c.id, { send: undefined }); if (STU.sxp && STU.sxp.id === c.id) STU.sxp = null; } },
  sxPick: it => { if (!sendKind(it)) return; STU.sxp = sxP(it) ? null : sxNew(it, null, -1); },
  sxEdit: (it, k) => { const e = sendList(it)[+k]; if (!e) return; STU.sxp = sxP(it) && STU.sxp.idx === +k ? null : sxNew(it, e, +k); },
  sxWhen: (it, v) => { const P = sxP(it); if (P && SEND_ONS[P.kind].includes(v)) { P.on = v; if (!SEND_HOLD.includes(v)) P.hold = false; } },
  sxAt: (it, d) => { const P = sxP(it); if (P) P.t = r2(Math.min(600, Math.max(0, P.t + (+d || 0)))); },
  sxMidi: (it, v) => { const P = sxP(it); if (P && ['none', 'note', 'cc'].includes(v)) { if (P.midi !== v) P.val = v === 'cc' ? 127 : 100; P.midi = v; if (v === 'none') P.hold = false; } },
  sxN: (it, d) => { const P = sxP(it); if (P) P.n = clampI(P.n + (+d || 0), 0, 127); },
  sxV: (it, d) => { const P = sxP(it); if (P) P.val = clampI(P.val + (+d || 0), 0, 127); },
  sxCh: (it, v) => { const P = sxP(it); if (!P) return; if (v === 'person') P.ch = 0; else if (v === 'one') P.ch = 1; else if (P.ch > 0) P.ch = clampI(P.ch + (+v || 0), 1, 16); },
  sxHold: (it, v) => { const P = sxP(it); if (P) P.hold = v === 'on' && P.midi !== 'none' && SEND_HOLD.includes(P.on); },
  // the page's address field (read as typed, sxInput) used; a headset's: the default, or the one the entry has
  sxOsc: it => { const P = sxP(it); if (!P) return; const s = (P.oscText === undefined ? P.osc : P.oscText).trim(); if (!s) { P.osc = ''; P.oscBad = false; } else if (SEND_OSC.test(s) && !s.includes('//')) { P.osc = s; P.oscBad = false; } else P.oscBad = true; P.oscText = undefined; },
  sxOscX: (it, v) => { const P = sxP(it); if (P) P.osc = v === 'own' ? P.osc0 : ''; },
  sxTry: (it, k) => {
    const e = sendList(it)[+k];
    if (!e) return;
    const d = { id: it.id, ev: e.on, at: Math.round(behNow()), try: 1 };
    if (e.on === 'at') d.t = e.t;
    sendFx(d);
  },
  sxAdd: it => {
    const P = sxP(it);
    if (!P) return;
    if (P.oscText !== undefined) ITEM_ACT.sxOsc(it);   // (an address typed and not yet used: taken with Add)
    if (P.oscBad) return;
    const d = sxDraft(P);
    if (!d) return;
    const L = sendList(it).slice();
    if (P.idx >= 0 && P.idx < L.length) L[P.idx] = d; else if (L.length >= SEND_MAX) return; else L.push(d);
    sendWrite(it, normSend(L, P.kind));
    STU.sxp = null;
  },
  sxDel: (it, k) => { const L = sendList(it).slice(); if (!(+k >= 0 && +k < L.length)) return; L.splice(+k, 1); sendWrite(it, L); if (STU.sxp && STU.sxp.id === it.id) STU.sxp = null; },
  // a motion's beat: Off (absent) or beats a period
  mbeat: (it, v) => { const b = v === 'off' ? undefined : +v; if (b !== undefined && !BEATS.includes(b)) return; motionSet(it, () => ({ beat: b })); },
});
PANE_ONLY.push('sxPick', 'sxEdit', 'sxWhen', 'sxAt', 'sxMidi', 'sxN', 'sxV', 'sxCh', 'sxHold', 'sxOsc', 'sxOscX', 'sxTry');
// the page's two fields, as typed (e7b_upload.js's input listener): the address kept until Use it or Add, the number at once
function sxInput(id, value) {
  const P = STU.sxp;
  if (!P) return;
  if (id === 'stuSendOsc') { P.oscText = String(value); return; }
  if (id === 'stuSendNum') { const n = Number(String(value).trim()); if (String(value).trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 127 && n !== P.n) { P.n = n; dirty(); } }
}
// a motion's On the beat (its card, after Starts)
const BEAT_WORD = { 0.25: '¼', 0.5: '½', 1: '1', 2: '2', 4: '4', 8: '8', 16: '16' };
function beatBlocks(it, B, dis) {
  const m = it.rec.motion;
  if (!m) return;
  B.push({ label: 'On the beat' + (m.beat ? `: ${BEAT_WORD[m.beat]} beat${m.beat === 1 ? '' : 's'} a ${MOTION[m.kind].one}` : ''), row: [{ id: 'mbeat:off', label: 'Off', act: 'i:mbeat', v: 'off', on: !m.beat, dis }].concat(BEATS.map(b => ({ id: 'mbeat:' + b, label: BEAT_WORD[b], act: 'i:mbeat', v: String(b), on: m.beat === b, dis }))) },
    { p: 'Follows the room\'s beat (from the output page\'s MIDI clock or OSC) while there is one.' + (m.beat && STU.bt ? ` The room's beat now: ${STU.bt.bpm} bpm.` : ''), c: 'faint' });
}
// the card's signature part
function sendSig() {
  const P = STU.sxp;
  return [P ? [P.id, P.idx, P.on, P.t, P.midi, P.n, P.val, P.ch, P.hold, P.osc, P.oscBad].join() : '', STU.bt ? STU.bt.bpm : '', STU.sw.size].join('|');
}

// ------------------------------------------------------------------ for tests --
// STUDIO.sends(), STUDIO.sendSet(id, list | null) (an edit, one Undo step, as a layout's), STUDIO.beatSet(id, beat | null)
function sendSet(id, list) {
  const it = STU.items.get(id);
  if (!it || !sendKind(it)) return null;
  const L = list === null || list === undefined ? [] : normSend(list, sendKind(it));
  if (L === null) return null;
  change(() => sendWrite(it, L));
  return sendList(STU.items.get(id)).map(e => Object.assign({}, e));
}
function beatSet(id, b) {
  const it = STU.items.get(id);
  if (!it || !it.rec.motion || (b !== null && b !== undefined && !BEATS.includes(b))) return null;
  change(() => motionSet(it, () => ({ beat: b === null ? undefined : b })));
  return STU.items.get(id).rec.motion.beat || null;
}

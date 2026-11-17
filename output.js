'use strict';
// ========================================================== the output page ==
// MIDI and OSC from the shared rooms and the studio (the owner, 16 November 2026: "make it opt in by default and say who
// entered", "both", "in and out", "output page and then midi or local relay for osc and trackers i guess?"). The contract
// is tools/output/SPEC.md; setting it up is tools/output/README.md.
//
// A computer's page in a room (Chrome or Edge; a laptop or the room's PC) becomes the room's output page: it follows a
// studio circle and runs the studio's scene itself (the studio's HOST.cur.out: its items' poses, its events, its actions),
// hears the people in a headset (HOST.collab.persons()) and the PC's trackers (HOST.collab.trackers()), and
//  - sends MIDI through the browser's Web MIDI to one output port (a virtual one: loopMIDI, the IAC Driver, ALSA), and OSC
//    over its room socket to the relay, which sends it as UDP to the targets on its own command line (--osc-out);
//  - takes MIDI from one input port and OSC from the relay (--osc-in, the shell's @osc) as the room's actions (press an
//    item, start or stop a sequence, show or hide an item, switch a cube, the room's beat from MIDI clock).
// What a scene's items send is the scene's (layout.json's send entries, edited on the studio's cards); streams (people,
// trackers, items, distances, as CC or OSC) and incoming mappings are this machine's (localStorage outMap, exported and
// imported as JSON). Loaded by shared.js the first time it starts (as peerjs.min.js is); never a story; every listener it
// adds on window, document or MIDI objects is the shell's (HOST.quiet), so a change of story never takes it.
(function () {
  if (typeof HOST === 'undefined' || (HOST.out && HOST.out.start)) return;
  const quiet = fn => { const q = HOST.quiet; HOST.quiet = true; try { return fn(); } finally { HOST.quiet = q; } };
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const put = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const isInt = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
  const isNum = (v, a, b) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
  const C = () => HOST.collab;
  const rnow = () => (C() && C().now ? C().now() : Date.now());   // the room's clock (ms)

  // ------------------------------------------------------------- the mapping --
  // { out: 1, opt, streams, incoming } (tools/output/SPEC.md, Lane PAGE 3), validated on every read; a bad row is dropped
  // and said
  const KEY = 'outMap', ROWS = 64, LOG_N = 200, SLOTS = 16, SLOT_KEEP = 60000;
  const ID_RE = /^[a-z0-9]{6}$/;
  const ADDR_RE = /^\/[A-Za-z0-9_.\-/]{0,127}$/;   // (an address of this page's own: as a send entry's)
  const IN_RE = /^\/[!-~]{0,255}$/;   // (an incoming address: anything OSC allows without spaces)
  const ACTS = ['press', 'start', 'stop', 'toggle', 'rewind', 'show', 'hide', 'flip', 'clear'];
  const HOLDS = { show: 'hide', hide: 'show', start: 'stop', stop: 'start' };
  const SRCS = ['head', 'hand', 'tracker', 'item', 'dist'], VALS = ['x', 'y', 'z', 'yaw', 'pitch', 'speed', 'd'];
  const MIDI_IN = ['note', 'cc', 'pc', 'start', 'stop', 'continue'];
  const OPT0 = { midi: false, midiOut: '', midiIn: '', osc: false, oscTrk: false, all: false, echo: false, people: false, peopleWhere: 'room', items: false, clock: false, noteLen: 100 };
  const newId = () => { let s = ''; for (const b of crypto.getRandomValues(new Uint8Array(6))) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]; return s; };
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  function normOpt(o) {
    const r = Object.assign({}, OPT0);
    if (!o || typeof o !== 'object') return r;
    for (const k of ['midi', 'osc', 'oscTrk', 'all', 'echo', 'people', 'items', 'clock']) r[k] = o[k] === true;
    r.midiOut = str(o.midiOut, 128); r.midiIn = str(o.midiIn, 128);
    r.peopleWhere = o.peopleWhere === 'circle' ? 'circle' : 'room';
    r.noteLen = isNum(o.noteLen, 5, 10000) ? Math.round(o.noteLen) : 100;
    return r;
  }
  // a stream's source (top: a dist may stand here; an endpoint is any other kind)
  function normSrc(s, top) {
    if (!s || typeof s !== 'object' || !SRCS.includes(s.k) || (!top && s.k === 'dist')) return null;
    if (s.k === 'dist') {
      const a = normSrc(s.a, false), b = normSrc(s.b, false);
      return a && b ? Object.assign({ k: 'dist', a, b }, s.flat === true ? { flat: true } : {}) : null;
    }
    const r = { k: s.k };
    if (s.k === 'head' || s.k === 'hand') r.who = s.who === 'any' || s.who === undefined ? 'any' : isInt(s.who, 1, SLOTS) ? s.who : null;
    if (r.who === null) return null;
    if (s.k === 'hand') r.hand = s.hand === 'l' ? 'l' : 'r';
    if (s.k === 'tracker' || s.k === 'item') { r.id = str(s.id, 64); if (!r.id) return null; }
    return r;
  }
  function normStream(x, why) {
    if (!x || typeof x !== 'object') return why('a stream that is not an object');
    if (!ID_RE.test(x.id)) return why('a stream without a good id');
    const src = normSrc(x.src, true);
    if (!src) return why(`stream ${x.id}: its source`);
    const v = src.k === 'dist' ? 'd' : x.v;
    if (!VALS.includes(v) || (v === 'd' && src.k !== 'dist')) return why(`stream ${x.id}: its value`);
    const min = isNum(x.min, -1e6, 1e6) ? x.min : 0, max = isNum(x.max, -1e6, 1e6) ? x.max : 1;
    if (min === max) return why(`stream ${x.id}: its range is empty`);
    const midi = x.midi && typeof x.midi === 'object' ? (isInt(x.midi.ch, 1, 16) && isInt(x.midi.cc, 0, 127) ? { ch: x.midi.ch, cc: x.midi.cc } : undefined) : null;
    if (midi === undefined) return why(`stream ${x.id}: its MIDI`);
    const osc = x.osc === undefined || x.osc === '' || x.osc === null ? '' : ADDR_RE.test(x.osc) && !x.osc.includes('//') ? x.osc : undefined;
    if (osc === undefined) return why(`stream ${x.id}: its OSC address`);
    return { id: x.id, on: x.on !== false, name: str(x.name, 40), src, v, min, max, curve: x.curve === 'inv' ? 'inv' : 'lin', smooth: isNum(x.smooth, 0, 0.95) ? x.smooth : 0,
      hz: isNum(x.hz, 1, 60) ? Math.round(x.hz) : 15, midi, osc };
  }
  function normFrom(f) {
    if (!f || typeof f !== 'object') return null;
    if (typeof f.osc === 'string') {
      if (!IN_RE.test(f.osc)) return null;
      return { osc: f.osc, arg: isInt(f.arg, 0, 31) ? f.arg : 0, min: isNum(f.min, -1e6, 1e6) ? f.min : 0.5 };
    }
    if (!MIDI_IN.includes(f.midi)) return null;
    const r = { midi: f.midi, ch: isInt(f.ch, 0, 16) ? f.ch : 0 };
    if (f.midi === 'note' || f.midi === 'cc' || f.midi === 'pc') { if (!isInt(f.n, 0, 127)) return null; r.n = f.n; }
    if (f.midi === 'cc') r.min = isInt(f.min, 1, 127) ? f.min : 64;
    return r;
  }
  function normIncoming(x, why) {
    if (!x || typeof x !== 'object') return why('an incoming row that is not an object');
    if (!ID_RE.test(x.id)) return why('an incoming row without a good id');
    const from = normFrom(x.from);
    if (!from) return why(`incoming ${x.id}: what it takes`);
    const a = x.act;
    if (!a || typeof a !== 'object' || !ACTS.includes(a.do) || !str(a.id, 64)) return why(`incoming ${x.id}: what it does`);
    return { id: x.id, on: x.on !== false, name: str(x.name, 40), from, act: Object.assign({ do: a.do, id: str(a.id, 64) }, a.hold === true && HOLDS[a.do] ? { hold: true } : {}) };
  }
  // a mapping read (localStorage, Import, HOST.out.map): { map, bad: [what was dropped, in words] }
  function normMap(j) {
    const bad = [], why = w => { bad.push(w); return null; };
    if (typeof j === 'string') { try { j = JSON.parse(j); } catch (e) { return { map: null, bad: ['not JSON: ' + e.message] }; } }
    if (!j || typeof j !== 'object' || Array.isArray(j)) return { map: null, bad: ['not a mapping'] };
    if (j.out !== 1) bad.push('not marked as an output page mapping (out: 1): read anyway');
    const map = { out: 1, opt: normOpt(j.opt), streams: [], incoming: [] };
    for (const [k, f] of [['streams', normStream], ['incoming', normIncoming]]) {
      const list = Array.isArray(j[k]) ? j[k] : [], seen = new Set();
      if (j[k] !== undefined && !Array.isArray(j[k])) bad.push(k + ': not a list');
      for (const x of list) {
        if (map[k].length >= ROWS) { bad.push(`${k}: more than ${ROWS} rows (the rest dropped)`); break; }
        const r = f(x, why);
        if (!r) continue;
        if (seen.has(r.id)) { bad.push(`${k}: id ${r.id} twice (the second dropped)`); continue; }
        seen.add(r.id); map[k].push(r);
      }
    }
    return { map, bad };
  }
  const copy = o => JSON.parse(JSON.stringify(o));

  // ---------------------------------------------------------------- the state --
  const O = {
    on: false, phase: 'off', why: '', map: null, bad: [], api: null, unlisten: null, timer: 0, el: null, vis: null,
    midi: { access: null, ok: false, err: '', busy: false, out: null, inp: null, outs: [], ins: [] },
    osc: { relay: null, pinged: 0, st: null, sent: 0, got: 0, dropped: 0, cfgAt: 0, q: [] },
    slots: new Map(), held: new Map(), offs: new Map(), log: [], events: 0, learn: '', edit: null, msg: '',
    live: new Map(), inc: new Map(), items: new Map(), itemsAt: 0, list: [], listAt: 0, peopleAt: 0, infoAt: 0, pers: [],
    clock: { n: 0, last: 0, iv: [], bpm: 0, at: 0, sentAt: -1e9 }, dirty: true, renderAt: 0, liveAt: 0, logSig: '', secs: {},
  };
  function load() {
    const r = normMap(get(KEY) || '{"out":1}');
    O.map = r.map || normMap({ out: 1 }).map;
    O.bad = r.bad.filter(w => !/marked as/.test(w));
    if (O.bad.length) say('Some of the saved mapping was dropped: ' + O.bad.join('; ') + '.');
  }
  const save = () => { put(KEY, JSON.stringify(O.map)); O.dirty = true; };
  const opt = () => O.map.opt;
  function say(t) { O.msg = t; O.dirty = true; }
  // the log: the last LOG_N messages in and out
  function note(dir, via, text, m) {
    O.log.push({ at: Math.round(rnow()), dir, via, text, m: m === undefined ? null : m });
    if (O.log.length > LOG_N) O.log.splice(0, O.log.length - LOG_N);
  }
  const memberOf = id => (id && C() ? (C().members || []).find(m => m.id === id) : null) || null;
  const whoOf = id => { const m = memberOf(id); return { id: id || '', name: m ? m.name || 'Someone' : id ? 'Someone' : '', color: m && /^#[0-9a-f]{6}$/i.test(m.color) ? m.color.toLowerCase() : '' }; };
  const slotOf = id => { const S = id && O.slots.get(id); return S && !S.gone ? S.slot : 0; };

  // -------------------------------------------------------------------- MIDI --
  // Web MIDI (Chrome, Edge): access.outputs and access.inputs, onstatechange, port.id, name, state, output.send(bytes),
  // input.onmidimessage (tools/output/SPEC.md, Wire 5; the tests' stub implements exactly these)
  function midiOn() {
    const M = O.midi;
    if (M.access || M.busy) { midiPorts(); return; }
    if (!navigator.requestMIDIAccess) { M.err = 'MIDI needs Chrome or Edge (this browser has no Web MIDI).'; M.ok = false; O.dirty = true; return; }
    M.busy = true; M.err = ''; O.dirty = true;
    let p;
    try { p = Promise.resolve(navigator.requestMIDIAccess({ sysex: false })); } catch (e) { p = Promise.reject(e); }
    p.then(acc => {
      M.busy = false;
      if (!O.on || !opt().midi) return;
      M.access = acc; M.ok = true;
      quiet(() => { acc.onstatechange = () => midiPorts(); });
      midiPorts();
      note('out', 'midi', 'MIDI on', null);
    }, e => { M.busy = false; M.ok = false; M.err = 'MIDI was refused: ' + ((e && e.message) || 'no reason given') + '.'; O.dirty = true; });
  }
  function midiOff() {
    const M = O.midi;
    releaseAll('MIDI off');
    if (M.inp) try { M.inp.onmidimessage = null; } catch (e) { /* gone */ }
    if (M.access) try { M.access.onstatechange = null; } catch (e) { /* gone */ }
    Object.assign(M, { access: null, ok: false, out: null, inp: null, outs: [], ins: [], busy: false });
    O.dirty = true;
  }
  const ports = it => { const a = []; try { for (const p of it.values()) if (p && p.state !== 'disconnected') a.push(p); } catch (e) { /* none */ } return a; };
  // the ports as they are now: the ones picked by name (none picked: the first of each)
  function midiPorts() {
    const M = O.midi, A = M.access;
    if (!A) return;
    M.outs = ports(A.outputs); M.ins = ports(A.inputs);
    const o = opt(), out = M.outs.find(p => p.name === o.midiOut) || (o.midiOut ? null : M.outs[0]) || null;
    const inp = M.ins.find(p => p.name === o.midiIn) || (o.midiIn ? null : M.ins[0]) || null;
    M.out = out;
    if (inp !== M.inp) {
      if (M.inp) try { M.inp.onmidimessage = null; } catch (e) { /* gone */ }
      M.inp = inp;
      if (inp) quiet(() => { inp.onmidimessage = e => midiIn(e && e.data); });
    }
    O.dirty = true;
  }
  const hex = b => [...b].map(x => x.toString(16).padStart(2, '0')).join(' ');
  function midiSend(bytes, text) {
    const M = O.midi;
    if (!opt().midi || !M.out) return false;
    try { M.out.send(bytes); } catch (e) { note('out', 'midi', 'refused: ' + text, bytes); return false; }
    note('out', 'midi', text, bytes);
    return true;
  }
  // a note on, its note off later (or at the paired end: held per item, entry and who)
  const PAIR = { enter: 'leave', on: 'off', hover: 'unhover', start: 'stop' }, ENDS = { leave: 1, off: 1, unhover: 1, stop: 1 };
  function midiEntry(e, ev, k) {
    const ch = (e.ch === 0 ? slotOf(ev.who) || 1 : e.ch || 1) - 1, key = ev.id + '|' + ev.ev + '|' + k + '|' + (ev.who || '');
    const hold = e.hold === true && !!PAIR[ev.ev];
    if (Number.isInteger(e.note)) {
      const on = [0x90 | ch, e.note & 127, Number.isInteger(e.val) ? e.val & 127 : 100], off = [0x80 | ch, e.note & 127, 0];
      if (hold && O.held.has(key)) midiSend(O.held.get(key).off, 'note off (again)');
      if (!midiSend(on, `note ${e.note} on, channel ${ch + 1} (${ev.ev} ${ev.name || ev.id})`)) return;
      if (hold) O.held.set(key, { id: ev.id, pair: PAIR[ev.ev], who: ev.who || '', off, text: `note ${e.note} off, channel ${ch + 1}` });
      else { const T = setTimeout(() => { O.offs.delete(T); midiSend(off, `note ${e.note} off, channel ${ch + 1}`); }, opt().noteLen); O.offs.set(T, off); }
    } else if (Number.isInteger(e.cc)) {
      if (!midiSend([0xB0 | ch, e.cc & 127, Number.isInteger(e.val) ? e.val & 127 : 127], `CC ${e.cc} channel ${ch + 1} (${ev.ev} ${ev.name || ev.id})`)) return;
      if (hold) O.held.set(key, { id: ev.id, pair: PAIR[ev.ev], who: ev.who || '', off: [0xB0 | ch, e.cc & 127, 0], text: `CC ${e.cc} to 0, channel ${ch + 1}` });
    }
  }
  // the paired end of held notes: that person's; none of theirs (an everyone cube's last one out): all of that item's
  function releasePair(ev) {
    const of = [...O.held].filter(([, H]) => H.id === ev.id && H.pair === ev.ev), mine = of.filter(([, H]) => H.who === (ev.who || ''));
    for (const [k, H] of mine.length ? mine : of) { O.held.delete(k); midiSend(H.off, H.text); }
  }
  function releaseWho(id, why) { for (const [k, H] of [...O.held]) if (H.who === id) { O.held.delete(k); midiSend(H.off, H.text + ' (' + why + ')'); } }
  function releaseAll(why) {
    for (const [k, H] of [...O.held]) { O.held.delete(k); midiSend(H.off, H.text + ' (' + why + ')'); }
    for (const [T, off] of [...O.offs]) { clearTimeout(T); O.offs.delete(T); midiSend(off, 'note off (' + why + ')'); }   // (notes still sounding: off now)
  }
  // MIDI in (a port's message, or HOST.out.midiIn for tests; at: the room's ms of it, default now)
  function midiIn(data, at) {
    if (!O.on || !data || !data.length) return;
    const b = [...data].map(x => x & 255), s = b[0], t = Number.isFinite(at) ? at : rnow();
    if (s === 0xF8) { if (opt().clock) clockTick(t); return; }   // (24 a beat: never logged one by one)
    let m = null;
    if (s === 0xFA || s === 0xFB || s === 0xFC) m = { midi: { 0xFA: 'start', 0xFB: 'continue', 0xFC: 'stop' }[s] };
    else {
      const k = s & 0xF0, ch = (s & 15) + 1;
      if (k === 0x90 && b.length >= 3) m = { midi: 'note', ch, n: b[1] & 127, v: b[2] & 127, on: (b[2] & 127) > 0 };
      else if (k === 0x80 && b.length >= 3) m = { midi: 'note', ch, n: b[1] & 127, v: 0, on: false };
      else if (k === 0xB0 && b.length >= 3) m = { midi: 'cc', ch, n: b[1] & 127, v: b[2] & 127 };
      else if (k === 0xC0 && b.length >= 2) m = { midi: 'pc', ch, n: b[1] & 127 };
    }
    note('in', 'midi', m ? midiText(m) : 'not used: ' + hex(b), b);
    if (!m) return;
    if (m.midi === 'start') clockStart(t);
    if (m.midi === 'stop' && opt().clock) clockStop();
    if (O.learn && (m.midi !== 'note' || m.on)) { learnFrom(m.midi === 'note' || m.midi === 'cc' || m.midi === 'pc' ? { midi: m.midi, ch: m.ch, n: m.n } : { midi: m.midi, ch: 0 }); return; }
    for (const r of O.map.incoming) {
      const f = r.from;
      if (!r.on || !f.midi || f.midi !== m.midi || (f.ch && m.ch && f.ch !== m.ch)) continue;
      if (m.midi === 'note') { if (f.n === m.n) fire(r, m.on); }
      else if (m.midi === 'cc') {
        if (f.n !== m.n) continue;
        const was = O.inc.has(r.id) ? O.inc.get(r.id) : 0;
        O.inc.set(r.id, m.v);
        if (m.v >= f.min && was < f.min) fire(r, true); else if (m.v < f.min && was >= f.min) fire(r, false);
      } else if (m.midi === 'pc') { if (f.n === m.n) fire(r, true); }
      else fire(r, true);
    }
  }
  const midiText = m => (m.midi === 'note' ? `note ${m.n} ${m.on ? 'on' : 'off'}, channel ${m.ch}` : m.midi === 'cc' ? `CC ${m.n} = ${m.v}, channel ${m.ch}` : m.midi === 'pc' ? `program ${m.n}, channel ${m.ch}` : m.midi);
  // MIDI clock to the room's beat (off by default): bpm from the median of the last 48 tick intervals, a beat at every 24th
  // tick from the last start (or the first tick heard); written when it moved by 0.5 bpm or the beat is 20 ms off, at most
  // once a second
  function clockStart() { Object.assign(O.clock, { n: 0, last: 0, iv: [] }); }
  function clockTick(t) {
    const K = O.clock;
    if (K.last) { const d = t - K.last; if (d > 0 && d < 1000) { K.iv.push(d); if (K.iv.length > 48) K.iv.shift(); } else K.iv = []; }
    K.last = t;
    const beat = K.n % 24 === 0;
    K.n++;
    if (!beat || K.iv.length < 12) return;
    const s = K.iv.slice().sort((a, b) => a - b), med = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    const bpm = Math.round(6000000 / (24 * med)) / 100;
    if (bpm < 20 || bpm > 300) return;
    let off = Infinity;
    if (K.bpm) { const P = 60000 / K.bpm, k = Math.round((t - K.at) / P); off = Math.abs(t - (K.at + k * P)); }
    if (K.bpm && Math.abs(bpm - K.bpm) < 0.5 && off <= 20) return;
    if (performance.now() - K.sentAt < 1000) return;
    K.sentAt = performance.now(); K.bpm = bpm; K.at = t;
    act({ do: 'beat', bpm, at: Math.round(t) }, 'MIDI clock');
  }
  function clockStop() {
    const K = O.clock;
    clockStart();
    if (!K.bpm) return;
    K.bpm = 0; K.sentAt = -1e9;
    act({ do: 'beat', bpm: 0 }, 'MIDI stop');
  }

  // --------------------------------------------------------------------- OSC --
  // OSC goes over the room socket to the relay (HOST.collab.osc: only on a relay), which sends it to its --osc-out targets;
  // messages are [address, types, ...args] (types i f s T F N)
  function oscMsg(addr, types, args) {
    if (!IN_RE.test(addr)) return null;
    const m = [addr, types];
    for (let i = 0; i < types.length; i++) {
      const c = types[i], a = args[i];
      if (c === 'i') m.push(Number.isFinite(a) ? clamp(Math.round(a), -2147483648, 2147483647) : 0);
      else if (c === 'f') m.push(Number.isFinite(a) ? Math.round(a * 1e6) / 1e6 : 0);
      else if (c === 's') m.push(String(a == null ? '' : a).slice(0, 256));
    }
    return m;
  }
  function oscOut(addr, types, args, text) {
    if (!opt().osc) return false;
    const m = oscMsg(addr, types, args);
    if (!m) return false;
    O.osc.q.push(m);
    if (text !== null) note('out', 'osc', text || addr, m);
    return true;
  }
  function oscFlush() {
    const q = O.osc.q;
    if (!q.length) return;
    O.osc.q = [];
    if (C().osc(q)) O.osc.sent += q.length; else O.osc.dropped += q.length;
  }
  const relayOsc = () => !!(C() && C().via === 'relay');
  function oscPing(force) {
    const t = performance.now();
    if (!relayOsc() || (!force && t - O.osc.pinged < 30000)) return;
    O.osc.pinged = t;
    C().oscPing().then(o => { O.osc.relay = o; O.dirty = true; });
  }
  // the trackers as OSC (the relay's own): asked again while the relay says it does not send them for this room
  function oscCfg(force) {
    const want = !!(opt().osc && opt().oscTrk), t = performance.now();
    if (!force && t - O.osc.cfgAt < 5000) return;
    O.osc.cfgAt = t;
    if (C().oscCfg({ trk: want })) note('out', 'room', 'trackers as OSC: ' + (want ? 'asked' : 'off'), null);
  }
  // the relay's @osc (shared.js hands it here): its status (st), or the messages of one UDP packet (m)
  function oscFx(v) {
    if (!O.on || !v || typeof v !== 'object') return;
    if (v.st && typeof v.st === 'object') {
      const s = v.st, n = x => (Number.isFinite(x) ? x : 0);
      O.osc.st = { out: n(s.out), in: n(s.in), trk: typeof s.trk === 'string' ? s.trk.slice(0, 16) : 'off', sent: n(s.sent), got: n(s.got), dropped: n(s.dropped) };
      if (opt().osc && opt().oscTrk && O.osc.st.trk === 'off') oscCfg(false);
      O.dirty = true;
    }
    if (Array.isArray(v.m)) for (const m of v.m.slice(0, 256)) oscIn(m);
  }
  const STUDIO_IN = { '/studio/press': 'press', '/studio/seq/start': 'start', '/studio/seq/stop': 'stop', '/studio/seq/toggle': 'toggle', '/studio/seq/rewind': 'rewind',
    '/studio/show': 'show', '/studio/hide': 'hide', '/studio/flip': 'flip', '/studio/clear': 'clear' };
  // one OSC message in ([address, types, ...args], as the relay normalises it; or HOST.out.oscIn for tests)
  function oscIn(m) {
    if (!O.on || !Array.isArray(m) || typeof m[0] !== 'string' || typeof m[1] !== 'string') return;
    const addr = m[0], types = m[1], args = [];
    for (let i = 0, k = 2; i < types.length; i++) {
      const c = types[i];
      if (c === 'T') args.push(true); else if (c === 'F') args.push(false); else if (c === 'N' || c === 'I') args.push(null); else args.push(m[k++]);
    }
    O.osc.got++;
    const txt = addr + (args.length ? ' ' + args.map(a => (typeof a === 'string' ? JSON.stringify(a) : String(a))).join(' ') : '');
    if (!opt().osc) { note('in', 'osc', txt + ' (OSC is off here)', m); return; }
    if (O.learn) { note('in', 'osc', txt, m); learnFrom({ osc: addr, arg: Math.max(0, args.findIndex(a => typeof a === 'number')) }); return; }
    let used = false;
    if (STUDIO_IN[addr]) { used = true; act({ do: STUDIO_IN[addr], id: args[0] == null ? '' : String(args[0]) }, 'OSC ' + addr); }
    else if (addr === '/studio/beat') { used = true; const bpm = typeof args[0] === 'number' ? args[0] : NaN; act({ do: 'beat', bpm, at: Math.round(rnow()) }, 'OSC ' + addr); }
    else if (addr === '/studio/beat/stop') { used = true; act({ do: 'beat', bpm: 0 }, 'OSC ' + addr); }
    for (const r of O.map.incoming) {
      const f = r.from;
      if (!r.on || f.osc !== addr) continue;
      used = true;
      const x = args[f.arg], v = typeof x === 'number' ? x : x === true ? 1 : x === false ? 0 : null;
      if (v === null) { fire(r, true); continue; }
      const was = O.inc.has(r.id) ? O.inc.get(r.id) : -Infinity;
      O.inc.set(r.id, v);
      if (v >= f.min && !(was >= f.min)) fire(r, true); else if (v < f.min && was >= f.min) fire(r, false);
    }
    note('in', 'osc', txt + (used ? '' : ' (not mapped: ignored)'), m);
  }

  // ------------------------------------------------------------- the actions --
  // an item named by its id or its exact name, in the studio's list
  function refOf(ref) {
    const find = L => L.find(i => i.id === ref) || L.find(i => i.name === ref);
    let x = find(itemList());
    if (!x) { O.listAt = 0; x = find(itemList()); }   // (an item added since the list was read, a second ago at most)
    return x ? x.id : ref;
  }
  function act(a, why) {
    const api = O.api;
    let r;
    if (!api || typeof api.act !== 'function') r = { ok: false, why: 'no studio scene here' };
    else {
      const b = Object.assign({}, a);
      if (typeof b.id === 'string') b.id = refOf(b.id);
      try { r = api.act(b) || { ok: false, why: 'no answer' }; } catch (e) { r = { ok: false, why: e.message }; }
    }
    note('in', 'room', `${why}: ${a.do}${a.id ? ' ' + a.id : ''}${a.do === 'beat' ? ' ' + a.bpm + ' bpm' : ''}${r.ok ? '' : ' refused (' + r.why + ')'}`, null);
    return r;
  }
  // an incoming row fired (on), or its value back below min / note off (hold: the opposite)
  function fire(r, on) {
    const d = on ? r.act.do : r.act.hold ? HOLDS[r.act.do] : '';
    if (d) act({ do: d, id: r.act.id }, 'mapped ' + (r.name || r.id));
  }
  function learnFrom(from) {
    const r = O.map.incoming.find(x => x.id === O.learn);
    O.learn = '';
    if (!r) return;
    const f = normFrom(Object.assign({ min: from.osc ? 0.5 : 64 }, from));
    if (f) { r.from = f; save(); say(`Learnt: ${r.name || r.id} now takes ${fromText(f)}.`); }
  }

  // -------------------------------------------------------------- the events --
  // what the studio says happened (HOST.cur.out.listen): each send entry of the item gives one OSC message (its own address
  // or the default) while OSC is on and a MIDI message (a note or a CC) while MIDI is on; an event with none (a press, a
  // sequence's start or stop) goes out with Every press and sequence, as OSC on its default address
  const KIND = { enter: 'cube', leave: 'cube', on: 'cube', off: 'cube', press: 'item', hover: 'item', unhover: 'item', start: 'seq', stop: 'seq', at: 'seq' };
  const ONE = { enter: 1, on: 1, press: 1, hover: 1, start: 1, at: 1 };
  function onEvent(ev) {
    if (!O.on || !ev || typeof ev !== 'object' || !KIND[ev.ev] || typeof ev.id !== 'string') return;
    O.events++; O.dirty = true;
    const W = whoOf(ev.who), send = Array.isArray(ev.send) ? ev.send : [];
    const txt = `${ev.ev} ${ev.name || ev.id}${W.id ? ' by ' + (W.name || W.id) : ''}${ev.try ? ' (Try)' : ''}`;
    if (ev.who && C() && ev.who === C().id && !opt().echo) { note('in', 'room', txt + ' (this page: not sent)', null); return; }
    note('in', 'room', txt, null);
    if (ENDS[ev.ev] && opt().midi) releasePair(ev);
    if (!opt().midi && !opt().osc) return;
    const def = `/studio/${KIND[ev.ev]}/${ev.id}/${ev.ev}`, types = ev.ev === 'at' ? 'ssssif' : 'ssssi';
    const args = [W.name, W.color, W.id, ev.name || '', ONE[ev.ev] ? 1 : 0].concat(ev.ev === 'at' ? [Number.isFinite(ev.t) ? ev.t : 0] : []);
    if (send.length) {
      send.slice(0, 8).forEach((e, k) => {
        if (!e || typeof e !== 'object') return;
        oscOut(typeof e.osc === 'string' && ADDR_RE.test(e.osc) ? e.osc : def, types, args);
        if (opt().midi && (Number.isInteger(e.note) || Number.isInteger(e.cc))) midiEntry(e, ev, k);
      });
    } else if (opt().all && (ev.ev === 'press' || ev.ev === 'start' || ev.ev === 'stop')) oscOut(def, types, args);
    oscFlush();
  }

  // ------------------------------------------------------- people and streams --
  // slots 1 to 16: each person in a headset the lowest free one as first seen, kept while this page runs, freed 60 s after
  // they leave
  function slotsStep(t) {
    const P = O.pers = C().persons ? C().persons() : [], here = new Set(P.map(p => p.id));
    for (const p of P) {
      let S = O.slots.get(p.id);
      if (!S) {
        const used = new Set([...O.slots.values()].map(x => x.slot));
        let k = 1;
        while (k <= SLOTS && used.has(k)) k++;
        if (k > SLOTS) continue;
        O.slots.set(p.id, (S = { slot: k, gone: 0, sig: '' }));
        O.dirty = true;
      }
      if (S.gone) { S.gone = 0; O.dirty = true; }
      Object.assign(S, { name: p.name, color: p.color, kind: p.kind, st: p.st });
    }
    for (const [id, S] of O.slots) {
      if (here.has(id)) continue;
      if (!S.gone) {
        S.gone = t; O.dirty = true;
        releaseWho(id, 'gone');
        if (opt().people) { oscOut(`/room/person/${S.slot}/gone`, '', [], null); }
      } else if (t - S.gone > SLOT_KEEP) { O.slots.delete(id); O.dirty = true; }
    }
  }
  const pose7 = a => (Array.isArray(a) && a.length === 7 && a.every(Number.isFinite) ? a : null);
  // People as OSC: 15 a second at most each (head, hands), their info on change and every 2 s
  function peopleStep(t) {
    if (!opt().people || !opt().osc || t - O.peopleAt < 1000 / 15) return;
    O.peopleAt = t;
    const all = t - O.infoAt > 2000, fol = C().following ? C().following() : '';
    if (all) O.infoAt = t;
    for (const p of O.pers) {
      const S = O.slots.get(p.id);
      if (!S || S.gone || (opt().peopleWhere === 'circle' && p.st !== fol)) continue;
      const b = p.body, h = b && pose7(b.head), base = `/room/person/${S.slot}`;
      if (h) oscOut(base + '/head', 'fffffff', h, null);
      if (b && Array.isArray(b.hands)) ['l', 'r'].forEach((s, i) => { const g = pose7(b.hands[i]); if (g) oscOut(base + '/hand/' + s, 'fffffff', g, null); });
      const sig = [p.name, p.color, p.kind].join('|');
      if (all || sig !== S.sig) { S.sig = sig; oscOut(base + '/info', 'ssss', [p.name, p.color, p.id, p.kind], `${base}/info ${p.name}`); }
    }
  }
  // the studio's items, refreshed once a second (no sequences: they have no pose)
  function itemList() {
    const t = performance.now();
    if (t - O.listAt > 1000) {
      O.listAt = t; O.list = [];
      try { if (O.api && O.api.ready && O.api.ready()) O.list = (O.api.list() || []).filter(x => x && typeof x.id === 'string'); } catch (e) { O.list = []; }
    }
    return O.list;
  }
  const angle = (a, b) => 2 * Math.acos(clamp(Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]), 0, 1)) * 180 / Math.PI;
  // Items as OSC: each item that moved more than 1 mm or 0.2 degrees, or was shown or hidden, at most 30 a second each
  function itemsStep(t) {
    if (!opt().items || !opt().osc || !O.api || t - O.itemsAt < 1000 / 30) return;
    O.itemsAt = t;
    for (const x of itemList()) {
      if (x.k === 'q') continue;
      let P = null;
      try { P = O.api.pose(x.id); } catch (e) { P = null; }
      if (!P || !Array.isArray(P.p) || !Array.isArray(P.q)) continue;
      const w = O.items.get(x.id), sh = P.shown ? 1 : 0;
      if (w && w.sh === sh && Math.hypot(P.p[0] - w.p[0], P.p[1] - w.p[1], P.p[2] - w.p[2]) <= 0.001 && angle(P.q, w.q) <= 0.2) continue;
      O.items.set(x.id, { p: P.p.slice(), q: P.q.slice(), sh });
      oscOut(`/studio/item/${x.id}/pose`, 'fffffffi', [...P.p, ...P.q, sh], null);
    }
  }
  // a source's pose now ({ p, q } in room coordinates), or null
  function personAt(who) {
    let best = null;
    for (const p of O.pers) {
      const S = O.slots.get(p.id);
      if (!S || S.gone) continue;
      if (who === 'any' ? !best || S.slot < best.s : S.slot === who) best = { p, s: S.slot };
    }
    return best && best.p;
  }
  function pointOf(s) {
    if (s.k === 'head' || s.k === 'hand') {
      const p = personAt(s.who), b = p && p.body, a = b && (s.k === 'head' ? pose7(b.head) : Array.isArray(b.hands) ? pose7(b.hands[s.hand === 'l' ? 0 : 1]) : null);
      return a ? { p: a.slice(0, 3), q: a.slice(3) } : null;
    }
    if (s.k === 'tracker') {
      let T = null;
      try { T = C().tracker ? C().tracker(s.id) : null; } catch (e) { T = null; }
      return T && Array.isArray(T.p) && Array.isArray(T.q) ? { p: T.p, q: T.q } : null;
    }
    if (s.k === 'item' && O.api) {
      let P = null;
      try { P = O.api.pose(refOf(s.id)); } catch (e) { P = null; }
      return P && Array.isArray(P.p) && Array.isArray(P.q) ? { p: P.p, q: P.q } : null;
    }
    return null;
  }
  const usesPerson = s => s.k === 'head' || s.k === 'hand' || (s.k === 'dist' && (usesPerson(s.a) || usesPerson(s.b)));
  // a stream's value as measured (m, degrees, m/s), or null when its source is not there
  function measure(r, L, t) {
    const s = r.src;
    if (s.k === 'dist') {
      const a = pointOf(s.a), b = pointOf(s.b);
      if (!a || !b) return null;
      return s.flat ? Math.hypot(a.p[0] - b.p[0], a.p[2] - b.p[2]) : Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]);
    }
    const P = pointOf(s);
    if (!P) { L.lp = null; return null; }
    if (r.v === 'x' || r.v === 'y' || r.v === 'z') return P.p['xyz'.indexOf(r.v)];
    if (r.v === 'speed') {
      const lp = L.lp, lt = L.lt;
      L.lp = P.p.slice(); L.lt = t;
      return lp && t > lt ? Math.hypot(P.p[0] - lp[0], P.p[1] - lp[1], P.p[2] - lp[2]) / ((t - lt) / 1000) : null;
    }
    const [x, y, z, w] = P.q, fx = -2 * (x * z + w * y), fy = -2 * (y * z - w * x), fz = -(1 - 2 * (x * x + y * y));   // (where it looks: -z turned by q)
    return r.v === 'yaw' ? Math.atan2(-fx, -fz) * 180 / Math.PI : Math.asin(clamp(fy, -1, 1)) * 180 / Math.PI;
  }
  function streamsStep(t) {
    for (const r of O.map.streams) {
      let L = O.live.get(r.id);
      if (!L) O.live.set(r.id, (L = { at: 0, y: null, s: null, v127: -1, x: null }));
      if (!r.on) continue;
      const hz = Math.min(r.hz, usesPerson(r.src) ? 15 : 60);
      if (t - L.at < 1000 / hz - 1) continue;
      L.at = t;
      const x = measure(r, L, t);
      if (x === null || !Number.isFinite(x)) { L.x = null; continue; }
      L.x = x;
      L.y = L.y === null ? x : L.y + (1 - r.smooth) * (x - L.y);
      let s = clamp((L.y - r.min) / (r.max - r.min), 0, 1);
      if (r.curve === 'inv') s = 1 - s;
      L.s = s;
      if (r.midi && opt().midi) {
        const v = Math.round(s * 127);
        if (v !== L.v127 && midiSendQuiet([0xB0 | (r.midi.ch - 1), r.midi.cc, v])) L.v127 = v;
      }
      if (r.osc && opt().osc) oscOut(r.osc, 'ff', [s, L.y], null);
    }
  }
  // (streams: sent without a log line each, or the log would hold nothing else; counted in the row's live value)
  function midiSendQuiet(b) { const M = O.midi; if (!opt().midi || !M.out) return false; try { M.out.send(b); return true; } catch (e) { return false; } }

  // ----------------------------------------------------------------- the step --
  function step() {
    if (!O.on) return;
    const t = performance.now(), c = C();
    if (!c || !c.code) { stop('left the room'); return; }
    // (the studio's API: HOST.cur.out, present from the studio's first frame; a new story or a new studio: listened to again)
    const api = HOST.cur && HOST.cur.out && typeof HOST.cur.out.listen === 'function' ? HOST.cur.out : null;
    if (api !== O.api) {
      if (O.unlisten) try { O.unlisten(); } catch (e) { /* gone */ }
      O.unlisten = null; O.api = api; O.listAt = 0; O.items.clear(); O.dirty = true;
      if (api) try { O.unlisten = api.listen(onEvent); } catch (e) { O.unlisten = null; }
      note('in', 'room', api ? 'the studio scene: listening' : 'no studio scene here: people and trackers only', null);
    }
    slotsStep(t);
    peopleStep(t);
    itemsStep(t);
    streamsStep(t);
    oscFlush();
    if (opt().osc) { oscPing(false); if (opt().oscTrk && O.osc.st && O.osc.st.trk === 'off') oscCfg(false); }
    if (O.dirty && t - O.renderAt > 250) render();
    else if (t - O.renderAt > 1000) render();
    if (t - O.liveAt > 250) liveRender(t);
  }

  // --------------------------------------------------------------- the overlay --
  const OUT_CSS = `
#out { position: fixed; left: 0; top: calc(60px + env(safe-area-inset-top, 0px)); bottom: 0; width: min(420px, 100vw); z-index: 9; overflow-y: auto; box-sizing: border-box;
  padding: 10px 12px 24px; background: rgba(4, 10, 20, 0.97); color: #e7eef8; font: 13px/1.4 B612, "Segoe UI", "Helvetica Neue", Arial, sans-serif; border-right: 1px solid rgba(149, 166, 189, 0.3); }
#out[hidden] { display: none !important; }
#out h2 { font-size: 17px; margin: 0; flex: 1; }
#out h3 { font-size: 13px; margin: 14px 0 6px; color: #9db4ff; text-transform: uppercase; letter-spacing: 0.04em; }
#out header { display: flex; align-items: center; gap: 8px; }
#out p { margin: 4px 0; }
#out .o-mute, #out .o-row span, #out li span { color: #a9b8cc; }
#out .o-warn { color: #ffb43b; }
#out .o-msg { color: #c3e85a; }
#out button, #out select, #out input, #out textarea { font: inherit; font-size: 12px; color: #e7eef8; background: rgba(149, 166, 189, 0.18); border: 1px solid rgba(149, 166, 189, 0.4); border-radius: 6px; padding: 4px 8px; min-height: 28px; box-sizing: border-box; }
#out button { cursor: pointer; }
#out button[aria-pressed="true"] { border-color: #46d9ff; background: rgba(70, 217, 255, 0.22); }
#out button.o-go { background: #46d9ff; color: #04131c; border-color: #46d9ff; font-weight: 700; }
#out button:disabled { opacity: 0.45; cursor: default; }
#out select { max-width: 100%; background: rgba(4, 10, 20, 0.9); }
#out input, #out textarea { background: rgba(4, 10, 20, 0.9); }
#out input[type="number"] { width: 72px; }
#out textarea { width: 100%; min-height: 60px; }
#out .o-btns { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 4px 0; }
#out ul { list-style: none; margin: 4px 0; padding: 0; }
#out li { padding: 4px 0; border-top: 1px solid rgba(149, 166, 189, 0.15); }
#out li i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
#out li b { font-weight: 600; }
#out .o-live { font-variant-numeric: tabular-nums; color: #46d9ff; }
#out form { display: grid; grid-template-columns: auto 1fr; gap: 4px 8px; align-items: center; padding: 6px; margin: 4px 0; border: 1px solid rgba(70, 217, 255, 0.4); border-radius: 8px; }
#out form label { color: #a9b8cc; }
#out form .o-btns { grid-column: 1 / -1; }
#out .o-log { font: 11px/1.35 ui-monospace, Menlo, Consolas, monospace; max-height: 260px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; color: #c5d2e3; background: rgba(0, 0, 0, 0.3); border-radius: 6px; padding: 6px; }
#out .o-log .in { color: #c3e85a; }
body.outp #gl { cursor: default; }
@media (max-width: 640px) { #out { width: 100vw; } }
`;
  const onOff = (on, label, act, title) => `<button type="button" data-o="${act}" aria-pressed="${!!on}"${title ? ` title="${esc(title)}"` : ''}>${esc(label)}: ${on ? 'On' : 'Off'}</button>`;
  function show() {
    if (!document.getElementById('outCss')) { const st = document.createElement('style'); st.id = 'outCss'; st.textContent = OUT_CSS; document.head.appendChild(st); }
    if (!O.el) {
      const el = O.el = document.createElement('div');
      el.id = 'out'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Output page');
      el.innerHTML = `<header><h2>Output page</h2><button type="button" data-o="stop">Stop</button></header>
        <p class="o-warn o-hidden" hidden>Keep this tab in front: a hidden tab stops the scene's frames.</p><p class="o-msg" hidden></p>
        ${['status', 'midi', 'osc', 'events', 'people', 'items', 'streams', 'incoming', 'io'].map(k => `<section data-sec="${k}"></section>`).join('')}
        <h3>Log</h3><div class="o-log" aria-live="off"></div>`;
      quiet(() => {
        el.addEventListener('click', onClick);
        el.addEventListener('change', onChange);
        el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.matches('input:not([type="checkbox"])') && e.target.form) { e.preventDefault(); onClick({ target: e.target.form.querySelector('[data-o^="save"]') }); } });
      });
      document.body.appendChild(el);
    }
    O.el.hidden = false;
    O.secs = {}; O.logSig = '';
    render(true);
  }
  // the sections, written again only when what they say changed and never under the field being typed in
  function render(force) {
    O.renderAt = performance.now(); O.dirty = false;
    const el = O.el;
    if (!el || !O.on) return;
    const hid = el.querySelector('.o-hidden');
    if (hid) hid.hidden = document.visibilityState !== 'hidden';
    const msg = el.querySelector('.o-msg');
    if (msg) { msg.hidden = !O.msg; msg.textContent = O.msg; }
    const S = { status: secStatus, midi: secMidi, osc: secOsc, events: secEvents, people: secPeople, items: secItems, streams: secStreams, incoming: secIncoming, io: secIo };
    for (const [k, f] of Object.entries(S)) {
      const box = el.querySelector(`[data-sec="${k}"]`);
      if (!box) continue;
      const html = f();
      if (!force && html === O.secs[k]) continue;
      const a = document.activeElement;
      if (!force && ((a && box.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) || box.querySelector('form'))) continue;   // (an edit open: only its own buttons write it again)
      box.innerHTML = html; O.secs[k] = html;
    }
    logRender();
  }
  function logRender() {
    const box = O.el && O.el.querySelector('.o-log'), L = O.log.slice(-60);
    const sig = O.log.length + '|' + (L.length ? L[L.length - 1].at + L[L.length - 1].text : '');
    if (!box || sig === O.logSig) return;
    O.logSig = sig;
    const t = n => new Date(n).toISOString().slice(11, 23);
    box.innerHTML = L.slice().reverse().map(e => `<div class="${e.dir}">${t(e.at)} ${e.dir === 'in' ? '&larr;' : '&rarr;'} ${e.via.toUpperCase()} ${esc(e.text)}</div>`).join('') || '<div>Nothing yet.</div>';
  }
  // the streams' live values, in place (never the whole section)
  function liveRender(t) {
    O.liveAt = t;
    if (!O.el) return;
    for (const sp of O.el.querySelectorAll('[data-live]')) {
      const L = O.live.get(sp.dataset.live), r = O.map.streams.find(x => x.id === sp.dataset.live);
      const txt = !r || !r.on ? 'off' : !L || L.x === null || L.y === null ? 'no value' : `${L.y.toFixed(r.v === 'yaw' || r.v === 'pitch' ? 1 : 3)} → ${L.s.toFixed(2)}${r.midi && opt().midi ? ' (' + Math.max(0, L.v127) + ')' : ''}`;
      if (sp.textContent !== txt) sp.textContent = txt;
    }
    logRender();
  }
  const stTitle = s => {
    const m = HOST.meta ? HOST.meta(s.story) : null, sc = s.story === 'studio' && C().sceneOf ? C().sceneOf(s.id) : '';
    return (sc ? 'Studio: ' + sc : (m && m.title) || s.story) + ' (' + s.id + ')';
  };
  const circles = () => (C().stations ? C().stations() : []).filter(s => !s.kind);   // (stories' circles: not the lobby, not All stories)
  function secStatus() {
    const c = C(), fol = c.following ? c.following() : '', S = fol && c.station ? c.station(fol) : null, via = { relay: 'on a relay', peer: 'peer to peer', local: 'on this device only' }[c.via] || c.via;
    const list = circles(), api = O.api;
    let scene = 'Not a studio circle: people and trackers only.';
    if (S && S.story === 'studio') { try { scene = api ? (api.ready() ? 'Scene: ' + (api.scene() || '(none)') + ', ' + itemList().length + ' items' : 'The scene is loading...') : 'The studio is loading...'; } catch (e) { scene = 'The studio is loading...'; } }
    return `<p>Room <b>${esc(c.code)}</b>, ${esc(via)}, as <b>Output page</b>.</p>
      <p><label>Follows <select data-oc="follow" aria-label="The circle this page follows"><option value="">(none)</option>${list.map(s => `<option value="${esc(s.id)}"${s.id === fol ? ' selected' : ''}>${esc(stTitle(s))}</option>`).join('')}</select></label></p>
      <p class="o-mute">${esc(list.some(s => s.story === 'studio') || S ? scene : 'No studio circle in this room yet: add one from the Shared dialog.')}</p>`;
  }
  function secMidi() {
    const M = O.midi, o = opt();
    const st = !o.midi ? 'Off.' : M.err ? M.err : M.busy ? 'Asking the browser for MIDI...' : !M.ok ? 'Starting...' : `${M.outs.length} output${M.outs.length === 1 ? '' : 's'}, ${M.ins.length} input${M.ins.length === 1 ? '' : 's'}.${!M.out ? ' No output port: make a virtual one (loopMIDI, the IAC Driver, ALSA).' : ''}`;
    const sel = (k, list, cur, label) => `<label>${label} <select data-oc="${k}" aria-label="MIDI ${label.toLowerCase()} port"${o.midi && M.ok ? '' : ' disabled'}>${list.length ? '' : '<option value="">(none)</option>'}${list.map(p => `<option value="${esc(p.name)}"${cur && cur.name === p.name ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>`;
    return `<h3>MIDI</h3><div class="o-btns">${onOff(o.midi, 'MIDI', 'midi')}<button type="button" data-o="test"${o.midi && M.out ? '' : ' disabled'}>Test note</button>${onOff(o.clock, 'MIDI clock to the room\'s beat', 'clock', 'The input\'s MIDI clock sets the room\'s beat, which motions on the beat follow')}</div>
      <div class="o-btns">${sel('midiOut', M.outs, M.out, 'Output')}${sel('midiIn', M.ins, M.inp, 'Input')}</div><p class="o-mute">${esc(st)}</p>`;
  }
  function secOsc() {
    const o = opt(), R = O.osc.relay, S = O.osc.st;
    let st;
    if (!relayOsc()) st = 'No OSC here: the room runs ' + ({ peer: 'peer to peer', local: 'on this device only' }[C().via] || 'without a relay') + '. MIDI still works.';
    else if (!R) st = 'The relay sends no OSC (or has not said yet): start it with --osc-out host:port and --osc-in port (tools/output/README.md).';
    else st = `The relay sends to ${R.out} target${R.out === 1 ? '' : 's'}${R.in ? ` and takes OSC on UDP port ${R.in}` : ' and takes no OSC in'}${R.trk ? '; it has the trackers' : ''}.`;
    const trk = S ? { off: 'not sent', on: 'sent for this room', none: 'the trackers\' bridge is silent', unaligned: 'the room\'s trackers are not lined up', other: 'another room\'s output page asked last' }[S.trk] || S.trk : '';
    return `<h3>OSC</h3><div class="o-btns">${onOff(o.osc, 'OSC', 'osc')}${onOff(o.oscTrk, 'Trackers as OSC (the relay)', 'oscTrk', 'The relay sends the PC\'s trackers as OSC itself, at their own rate, in the room\'s coordinates')}</div>
      <p class="o-mute">${esc(st)}</p><p class="o-mute">Sent ${O.osc.sent}, taken ${O.osc.got}${O.osc.dropped ? ', not sent ' + O.osc.dropped : ''}${S ? ` · the relay: sent ${S.sent}, taken ${S.got}, dropped ${S.dropped}${o.oscTrk ? ', trackers ' + esc(trk) : ''}` : ''}.</p>`;
  }
  function secEvents() {
    const o = opt();
    return `<h3>Events</h3><p class="o-mute">The scene's sends (cubes walked into or switched, presses, pointing, sequences: set on the studio's cards) go out while MIDI or OSC is on. ${O.events} event${O.events === 1 ? '' : 's'} so far.</p>
      <div class="o-btns">${onOff(o.all, 'Every press and sequence on the default addresses', 'all')}${onOff(o.echo, 'Also what this page caused', 'echo')}
      <label>Note length <input type="number" min="5" max="10000" step="10" data-oc="noteLen" value="${o.noteLen}" aria-label="Note length (ms)"> ms</label></div>`;
  }
  function secPeople() {
    const o = opt(), rows = [...O.slots].sort((a, b) => a[1].slot - b[1].slot);
    return `<h3>People</h3><div class="o-btns">${onOff(o.people, 'People as OSC', 'people', 'Heads and hands at most 15 a second each, /room/person/<slot>/...')}
      <select data-oc="peopleWhere" aria-label="Whose heads and hands"><option value="room"${o.peopleWhere === 'room' ? ' selected' : ''}>Everyone in the room</option><option value="circle"${o.peopleWhere === 'circle' ? ' selected' : ''}>At this circle</option></select></div>
      <ul>${rows.length ? rows.map(([id, S]) => `<li><b>${S.slot}</b> <i style="background:${esc(S.color || '#888')}"></i>${esc(S.name || 'Someone')} <span>${S.kind === 'ar' ? 'headset' : 'headset (VR)'}${S.gone ? ' · gone' : ''} · ${esc(id)}</span></li>`).join('') : '<li class="o-mute">Nobody in a headset yet.</li>'}</ul>`;
  }
  function secItems() {
    return `<h3>Items</h3><div class="o-btns">${onOff(opt().items, 'Items as OSC', 'items', 'Each item\'s pose as it moves, /studio/item/<id>/pose, at most 30 a second each')}</div>`;
  }
  const whoText = w => (w === 'any' ? 'anyone' : 'person ' + w);
  const srcText = s => (s.k === 'head' ? 'Head of ' + whoText(s.who) : s.k === 'hand' ? (s.hand === 'l' ? 'Left' : 'Right') + ' hand of ' + whoText(s.who) : s.k === 'tracker' ? 'Tracker ' + s.id : s.k === 'item' ? 'Item ' + s.id
    : `Distance from ${srcText(s.a).toLowerCase()} to ${srcText(s.b).toLowerCase()}${s.flat ? ' along the floor' : ''}`);
  const VAL_SAY = { x: 'x', y: 'height (y)', z: 'z', yaw: 'yaw (degrees)', pitch: 'pitch (degrees)', speed: 'speed (m/s)', d: 'distance (m)' };
  const streamText = r => `${srcText(r.src)} · ${VAL_SAY[r.v]} · ${r.min} to ${r.max}${r.curve === 'inv' ? ' (inverted)' : ''}${r.smooth ? ', smoothed ' + r.smooth : ''}, ${r.hz}/s` +
    (r.midi ? ` → CC ${r.midi.cc} channel ${r.midi.ch}` : '') + (r.osc ? ` → OSC ${r.osc}` : '') + (!r.midi && !r.osc ? ' (sends nothing)' : '');
  const fromText = f => (f.osc ? `OSC ${f.osc} (argument ${f.arg}, from ${f.min})` : f.midi === 'note' ? `note ${f.n}` : f.midi === 'cc' ? `CC ${f.n} (from ${f.min})` : f.midi === 'pc' ? `program ${f.n}` : 'MIDI ' + f.midi) +
    (f.midi && f.ch ? ', channel ' + f.ch : f.midi ? ', any channel' : '');
  const ACT_SAY = { press: 'press', start: 'start', stop: 'stop', toggle: 'start or stop', rewind: 'rewind', show: 'show', hide: 'hide', flip: 'show or hide', clear: 'clear the switch of' };
  const inText = r => `${fromText(r.from)} → ${ACT_SAY[r.act.do]} ${r.act.id}${r.act.hold ? ' (held)' : ''}`;
  function secStreams() {
    const E = O.edit && O.edit.kind === 'stream' ? O.edit : null;
    return `<h3>Streams</h3><p class="o-mute">A value measured all the time (a height, a distance, a speed), mapped to 0 to 1, sent as a MIDI controller and OSC.</p>
      <ul>${O.map.streams.map(r => `<li><b>${esc(r.name || r.id)}</b> <span class="o-live" data-live="${r.id}"></span><br><span>${esc(streamText(r))}</span>
        <div class="o-btns">${onOff(r.on, 'Sending', 'son:' + r.id)}<button type="button" data-o="sedit:${r.id}">Edit</button><button type="button" data-o="sdel:${r.id}" aria-label="Remove ${esc(r.name || r.id)}">✕</button></div>
        ${E && E.id === r.id ? streamForm(E.d) : ''}</li>`).join('')}${E && E.add ? '<li>' + streamForm(E.d) + '</li>' : ''}</ul>
      <div class="o-btns"><button type="button" data-o="sadd"${O.map.streams.length >= ROWS || E ? ' disabled' : ''}>Add a stream</button></div>`;
  }
  function secIncoming() {
    const E = O.edit && O.edit.kind === 'in' ? O.edit : null;
    return `<h3>Incoming</h3><p class="o-mute">Always taken while OSC is on: /studio/press, /studio/seq/start, stop, toggle, rewind, /studio/show, hide, flip, clear (an item's id or name), /studio/beat (bpm), /studio/beat/stop.</p>
      <ul>${O.map.incoming.map(r => `<li><b>${esc(r.name || r.id)}</b><br><span>${esc(inText(r))}</span>
        <div class="o-btns">${onOff(r.on, 'Taking', 'ion:' + r.id)}<button type="button" data-o="ilearn:${r.id}" aria-pressed="${O.learn === r.id}">${O.learn === r.id ? 'Learning: send it now' : 'Learn'}</button><button type="button" data-o="iedit:${r.id}">Edit</button><button type="button" data-o="idel:${r.id}" aria-label="Remove ${esc(r.name || r.id)}">✕</button></div>
        ${E && E.id === r.id ? inForm(E.d) : ''}</li>`).join('')}${E && E.add ? '<li>' + inForm(E.d) + '</li>' : ''}</ul>
      <div class="o-btns"><button type="button" data-o="iadd"${O.map.incoming.length >= ROWS || E ? ' disabled' : ''}>Add an incoming mapping</button></div>`;
  }
  function secIo() {
    return `<h3>Mapping</h3><p class="o-mute">The streams, the incoming mappings and these switches are this computer's (kept in this browser); the scene's sends are the scene's.</p>
      <div class="o-btns"><button type="button" data-o="export">Export</button><label>Import a file <input type="file" accept="application/json,.json" data-oc="importFile"></label></div>
      <textarea data-oc="importText" aria-label="A mapping pasted as JSON" placeholder="or paste a mapping here"></textarea><div class="o-btns"><button type="button" data-o="import">Import the pasted mapping</button></div>
      ${O.bad.length ? `<p class="o-warn">${esc(O.bad.join('; '))}</p>` : ''}`;
  }
  // the edit forms (a draft: its fields as typed, read back as a row on Save)
  const opts = (list, cur, say) => list.map(v => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(say ? say(v) : v)}</option>`).join('');
  const WHO = ['any'].concat(Array.from({ length: SLOTS }, (_, i) => i + 1));
  function srcFields(p, s, top) {
    const k = s.k || 'head';
    let h = `<label>${p ? p.toUpperCase() + ': ' : ''}Source</label><select data-f="${p}k" data-re="1">${opts(top ? SRCS : SRCS.slice(0, 4), k, v => ({ head: 'Head', hand: 'Hand', tracker: 'Tracker', item: 'Item', dist: 'Distance between two' }[v]))}</select>`;
    if (k === 'dist') return h + srcFields('a', s.a || { k: 'head', who: 'any' }, false) + srcFields('b', s.b || { k: 'item' }, false) + `<label>Along the floor</label><input type="checkbox" data-f="flat"${s.flat ? ' checked' : ''}>`;
    if (k === 'head' || k === 'hand') h += `<label>${p ? p.toUpperCase() + ': ' : ''}Person</label><select data-f="${p}who">${opts(WHO, s.who || 'any', v => (v === 'any' ? 'Anyone (the lowest slot)' : 'Slot ' + v))}</select>`;
    if (k === 'hand') h += `<label>${p ? p.toUpperCase() + ': ' : ''}Hand</label><select data-f="${p}hand">${opts(['l', 'r'], s.hand || 'r', v => (v === 'l' ? 'Left' : 'Right'))}</select>`;
    if (k === 'tracker' || k === 'item') {
      const ids = k === 'item' ? itemList().filter(x => x.k !== 'q').map(x => [x.id, x.name]) : (C().trackers ? C().trackers() : []).map(x => [x.id, x.name]);
      h += `<label>${p ? p.toUpperCase() + ': ' : ''}${k === 'item' ? 'Item' : 'Tracker'}</label><select data-f="${p}id"><option value=""></option>${ids.map(([id, n]) => `<option value="${esc(id)}"${id === s.id ? ' selected' : ''}>${esc(n ? n + ' (' + id + ')' : id)}</option>`).join('')}${s.id && !ids.some(x => x[0] === s.id) ? `<option value="${esc(s.id)}" selected>${esc(s.id)}</option>` : ''}</select>`;
    }
    return h;
  }
  function streamForm(d) {
    const vals = d.src.k === 'dist' ? ['d'] : VALS.filter(v => v !== 'd');
    return `<form data-form="stream" onsubmit="return false"><label>Name</label><input data-f="name" maxlength="40" value="${esc(d.name || '')}">
      ${srcFields('', d.src, true)}<label>Value</label><select data-f="v">${opts(vals, d.v, v => VAL_SAY[v])}</select>
      <label>From</label><input type="number" step="any" data-f="min" value="${d.min}"><label>To</label><input type="number" step="any" data-f="max" value="${d.max}">
      <label>Curve</label><select data-f="curve">${opts(['lin', 'inv'], d.curve, v => (v === 'lin' ? 'As measured' : 'Inverted'))}</select>
      <label>Smoothing</label><input type="number" min="0" max="0.95" step="0.05" data-f="smooth" value="${d.smooth}"><label>Rate (a second)</label><input type="number" min="1" max="60" step="1" data-f="hz" value="${d.hz}">
      <label>MIDI channel</label><select data-f="mch">${opts(['', ...Array.from({ length: 16 }, (_, i) => i + 1)], d.midi ? d.midi.ch : '', v => (v === '' ? 'No MIDI' : v))}</select>
      <label>Controller (CC)</label><input type="number" min="0" max="127" step="1" data-f="mcc" value="${d.midi ? d.midi.cc : 7}">
      <label>OSC address</label><input data-f="osc" maxlength="128" placeholder="/my/value (none: no OSC)" value="${esc(d.osc || '')}">
      <div class="o-btns"><button type="button" class="o-go" data-o="save:stream">Save</button><button type="button" data-o="cancel">Cancel</button></div></form>`;
  }
  function inForm(d) {
    const f = d.from, kind = f.osc !== undefined ? 'osc' : f.midi;
    let h = `<form data-form="in" onsubmit="return false"><label>Name</label><input data-f="name" maxlength="40" value="${esc(d.name || '')}">
      <label>Takes</label><select data-f="fk" data-re="1">${opts([...MIDI_IN, 'osc'], kind, v => ({ note: 'MIDI note', cc: 'MIDI controller (CC)', pc: 'MIDI program change', start: 'MIDI start', stop: 'MIDI stop', continue: 'MIDI continue', osc: 'OSC message' }[v]))}</select>`;
    if (kind === 'osc') h += `<label>Address</label><input data-f="osc" maxlength="256" value="${esc(f.osc || '/')}"><label>Argument</label><input type="number" min="0" max="31" step="1" data-f="arg" value="${f.arg || 0}"><label>Fires from</label><input type="number" step="any" data-f="omin" value="${f.min === undefined ? 0.5 : f.min}">`;
    else {
      h += `<label>Channel</label><select data-f="ch">${opts([0, ...Array.from({ length: 16 }, (_, i) => i + 1)], f.ch || 0, v => (v === 0 ? 'Any' : v))}</select>`;
      if (kind === 'note' || kind === 'cc' || kind === 'pc') h += `<label>${kind === 'note' ? 'Note' : kind === 'cc' ? 'Controller' : 'Program'}</label><input type="number" min="0" max="127" step="1" data-f="n" value="${f.n || 0}">`;
      if (kind === 'cc') h += `<label>Fires from</label><input type="number" min="1" max="127" step="1" data-f="min" value="${f.min || 64}">`;
    }
    const ids = itemList();
    h += `<label>Does</label><select data-f="do">${opts(ACTS, d.act.do, v => ({ press: 'Press', start: 'Start a sequence', stop: 'Stop a sequence', toggle: 'Start or stop a sequence', rewind: 'Rewind a sequence', show: 'Show', hide: 'Hide', flip: 'Show or hide', clear: 'Clear the switch' }[v]))}</select>
      <label>Item</label><input data-f="id" list="outItems" maxlength="64" value="${esc(d.act.id || '')}" placeholder="its id or exact name"><datalist id="outItems">${ids.map(x => `<option value="${esc(x.id)}">${esc(x.name || '')}</option>`).join('')}</datalist>
      <label>Held</label><label><input type="checkbox" data-f="hold"${d.act.hold ? ' checked' : ''}> the opposite as it lets go (show, hide, start, stop)</label>
      <div class="o-btns"><button type="button" class="o-go" data-o="save:in">Save</button><button type="button" data-o="cancel">Cancel</button></div></form>`;
    return h;
  }
  // a form's fields read back as a draft
  function readForm(form, kind) {
    const v = k => { const x = form.querySelector(`[data-f="${k}"]`); return !x ? undefined : x.type === 'checkbox' ? x.checked : x.value; };
    const n = k => { const x = v(k); return x === undefined || x === '' ? undefined : Number(x); };
    const W = x => (x === 'any' || x === undefined ? 'any' : Number(x));
    const src = p => { const k = v(p + 'k') || 'head'; return k === 'dist' ? { k } : { k, who: W(v(p + 'who')), hand: v(p + 'hand'), id: v(p + 'id') }; };
    if (kind === 'stream') {
      const s = src('');
      if (s.k === 'dist') Object.assign(s, { a: src('a'), b: src('b'), flat: !!v('flat') });
      const ch = n('mch');
      return { name: v('name') || '', src: s, v: s.k === 'dist' ? 'd' : v('v'), min: n('min'), max: n('max'), curve: v('curve'), smooth: n('smooth'), hz: n('hz'), midi: ch ? { ch, cc: n('mcc') } : null, osc: (v('osc') || '').trim() };
    }
    const fk = v('fk'), from = fk === 'osc' ? { osc: (v('osc') || '').trim(), arg: n('arg'), min: n('omin') } : { midi: fk, ch: n('ch') || 0, n: n('n'), min: n('min') };
    return { name: v('name') || '', from, act: { do: v('do'), id: (v('id') || '').trim(), hold: !!v('hold') } };
  }
  const STREAM0 = () => ({ name: '', src: { k: 'head', who: 'any' }, v: 'y', min: 0, max: 2, curve: 'lin', smooth: 0.5, hz: 15, midi: { ch: 1, cc: 7 }, osc: '' });
  const IN0 = () => ({ name: '', from: { midi: 'note', ch: 0, n: 60 }, act: { do: 'press', id: '' } });
  function onClick(e) {
    const b = e.target && e.target.closest ? e.target.closest('[data-o]') : null;
    if (!b || b.disabled) return;
    const [a, arg] = b.dataset.o.split(':'), o = opt();
    O.msg = '';
    if (a === 'stop') { stop('button'); return; }
    if (a === 'midi') { o.midi = !o.midi; save(); if (o.midi) midiOn(); else midiOff(); }
    else if (a === 'test') { midiSend([0x90, 60, 100], 'test note 60 on, channel 1'); const T = setTimeout(() => { O.offs.delete(T); midiSend([0x80, 60, 0], 'test note 60 off, channel 1'); }, o.noteLen); O.offs.set(T, [0x80, 60, 0]); }
    else if (['clock', 'all', 'echo', 'people', 'items'].includes(a)) { o[a] = !o[a]; if (a === 'items') O.items.clear(); if (a === 'clock') clockStart(); save(); }
    else if (a === 'osc') { o.osc = !o.osc; save(); if (o.osc) oscPing(true); oscCfg(true); O.items.clear(); }
    else if (a === 'oscTrk') { o.oscTrk = !o.oscTrk; save(); oscCfg(true); }
    else if (a === 'son' || a === 'ion') { const r = (a === 'son' ? O.map.streams : O.map.incoming).find(x => x.id === arg); if (r) { r.on = !r.on; save(); } }
    else if (a === 'sdel' || a === 'idel') { const k = a === 'sdel' ? 'streams' : 'incoming'; O.map[k] = O.map[k].filter(x => x.id !== arg); O.live.delete(arg); O.inc.delete(arg); if (O.edit && O.edit.id === arg) O.edit = null; save(); }
    else if (a === 'sadd') O.edit = { kind: 'stream', add: true, id: '', d: STREAM0() };
    else if (a === 'iadd') O.edit = { kind: 'in', add: true, id: '', d: IN0() };
    else if (a === 'sedit' || a === 'iedit') { const r = (a === 'sedit' ? O.map.streams : O.map.incoming).find(x => x.id === arg); if (r) O.edit = { kind: a === 'sedit' ? 'stream' : 'in', add: false, id: arg, d: copy(r) }; }
    else if (a === 'cancel') O.edit = null;
    else if (a === 'save') saveEdit(b.closest('form'), arg);
    else if (a === 'ilearn') O.learn = O.learn === arg ? '' : arg;
    else if (a === 'export') exportMap();
    else if (a === 'import') { const t = O.el.querySelector('[data-oc="importText"]'); if (t && t.value.trim()) importMap(t.value); }
    render(true);
  }
  function saveEdit(form, kind) {
    if (!form || !O.edit) return;
    const d = readForm(form, kind), E = O.edit, id = E.add ? newId() : E.id, bad = [];
    const r = (kind === 'stream' ? normStream : normIncoming)(Object.assign({ id, on: true }, d, E.add ? {} : { on: ((kind === 'stream' ? O.map.streams : O.map.incoming).find(x => x.id === id) || {}).on !== false }), w => { bad.push(w); return null; });
    if (!r) { say('Not saved: ' + bad.join('; ').replace(/^(stream|incoming) [a-z0-9]{6}: /, '') + '.'); E.d = d; return; }
    const list = kind === 'stream' ? O.map.streams : O.map.incoming, i = list.findIndex(x => x.id === id);
    if (i >= 0) list[i] = r; else list.push(r);
    O.live.delete(id); O.inc.delete(id); O.edit = null;
    save();
  }
  function onChange(e) {
    const x = e.target;
    if (!x) return;
    const k = x.dataset && x.dataset.oc, o = opt();
    if (x.dataset && x.dataset.re && O.edit) {   // (a form's kind changed: the form again, with what was typed)
      const form = x.closest('form');
      O.edit.d = readForm(form, O.edit.kind);
      if (O.edit.kind === 'stream') { const s = O.edit.d.src; if (s.k === 'dist') { s.a = s.a || { k: 'head', who: 'any' }; s.b = s.b || { k: 'item', id: '' }; O.edit.d.v = 'd'; } else if (O.edit.d.v === 'd') O.edit.d.v = 'y'; }
      else { const f = O.edit.d.from; if (f.osc === undefined && f.midi === undefined) O.edit.d.from = { osc: '/' }; }
      render(true);
      return;
    }
    if (!k) return;
    if (x.tagName === 'SELECT') x.blur();   // (a picked select keeps no focus: its section is written again as it changes)
    if (k === 'follow') { if (x.value && C().follow) C().follow(x.value); }
    else if (k === 'midiOut' || k === 'midiIn') { o[k] = x.value; save(); midiPorts(); }
    else if (k === 'noteLen') { const v = Number(x.value); if (v >= 5 && v <= 10000) { o.noteLen = Math.round(v); save(); } }
    else if (k === 'peopleWhere') { o.peopleWhere = x.value === 'circle' ? 'circle' : 'room'; save(); }
    else if (k === 'importFile') { const f = x.files && x.files[0]; if (f) f.text().then(t => { importMap(t); render(true); }, () => say('That file could not be read.')); }
    O.dirty = true;
  }
  function exportMap() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(O.map, null, 2)], { type: 'application/json' })), a = document.createElement('a');
    a.href = url; a.download = 'output-mapping.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    note('out', 'room', 'mapping exported', null);
  }
  // a mapping put in its place (Import, HOST.out.map(json)): the problems found ([]: none); nothing usable, nothing changed
  function importMap(j) {
    const r = normMap(j);
    if (!r.map) { say('Not imported: ' + r.bad.join('; ') + '.'); return r.bad; }
    const was = opt();
    O.map = r.map; O.bad = r.bad; O.live.clear(); O.inc.clear(); O.items.clear(); O.edit = null; O.learn = '';
    save();
    if (was.midi && !opt().midi) midiOff(); else if (opt().midi) midiOn();
    if (was.osc !== opt().osc || was.oscTrk !== opt().oscTrk) oscCfg(true);
    if (opt().osc) oscPing(true);
    say(r.bad.length ? 'Imported, with problems: ' + r.bad.join('; ') + '.' : `Imported: ${O.map.streams.length} stream${O.map.streams.length === 1 ? '' : 's'}, ${O.map.incoming.length} incoming.`);
    return r.bad;
  }

  // ------------------------------------------------------- starting, stopping --
  // the circle to follow: the one followed if it is a studio's, else the first studio circle by id
  function pickCircle() {
    const c = C(), fol = c.following ? c.following() : '', S = fol && c.station(fol);
    if (S && S.story === 'studio') return;
    const st = circles().filter(s => s.story === 'studio').sort((a, b) => a.id.localeCompare(b.id))[0];
    if (st && c.follow) c.follow(st.id);
  }
  function start(why) {
    const c = C();
    if (O.on) return true;
    if (!c || !c.code) return false;
    load();
    Object.assign(O, { on: true, phase: 'live', why: why || 'api', api: null, unlisten: null, events: 0, learn: '', edit: null });
    O.osc = { relay: null, pinged: 0, st: null, sent: 0, got: 0, dropped: 0, cfgAt: 0, q: [] };
    c.outMark(true);
    pickCircle();
    show();
    O.vis = () => { O.dirty = true; render(); };
    quiet(() => document.addEventListener('visibilitychange', O.vis));
    O.timer = setInterval(step, 16);
    if (opt().midi) midiOn();
    if (opt().osc) { oscPing(true); if (opt().oscTrk) setTimeout(() => { if (O.on) oscCfg(true); }, 500); }
    note('out', 'room', 'output page on (' + O.why + ')', null);
    return true;
  }
  function stop(why) {
    if (!O.on) return false;
    note('out', 'room', 'output page off (' + why + ')', null);
    releaseAll('stopped');
    if (opt().osc && opt().oscTrk) C().oscCfg({ trk: false });
    oscFlush();
    midiOff();
    if (O.unlisten) try { O.unlisten(); } catch (e) { /* gone */ }
    clearInterval(O.timer); O.timer = 0;
    if (O.vis) document.removeEventListener('visibilitychange', O.vis);
    Object.assign(O, { on: false, phase: 'off', api: null, unlisten: null, vis: null, edit: null, learn: '' });
    O.slots.clear(); O.live.clear(); O.inc.clear(); O.items.clear();
    if (O.el) { O.el.remove(); O.el = null; }
    if (C() && C().outMark) C().outMark(false);
    return true;
  }

  HOST.out = {
    v: 1, start, stop, on: () => O.on,
    // where it stands (tests): { on, phase, room, via, station, story, studio, midi, osc, people, opt, streams, incoming, events }
    state() {
      const c = C(), fol = c && c.following ? c.following() : '', S = fol && c.station ? c.station(fol) : null, M = O.midi;
      return { on: O.on, phase: O.phase, room: (c && c.code) || '', via: (c && c.via) || '', station: fol || '', story: S ? S.story : '', studio: !!O.api,
        midi: { on: !!(O.map && opt().midi), ok: M.ok, err: M.err, outs: M.outs.map(p => p.name), ins: M.ins.map(p => p.name), out: M.out ? M.out.name : '', in: M.inp ? M.inp.name : '' },
        osc: { on: !!(O.map && opt().osc), relay: O.osc.relay, st: O.osc.st, sent: O.osc.sent, got: O.osc.got, dropped: O.osc.dropped },
        people: [...O.slots].filter(([, S2]) => !S2.gone).map(([id, S2]) => ({ slot: S2.slot, id, name: S2.name || '', color: S2.color || '', kind: S2.kind || '' })).sort((a, b) => a.slot - b.slot),
        opt: O.map ? copy(opt()) : null, streams: O.map ? copy(O.map.streams) : [], incoming: O.map ? copy(O.map.incoming) : [], events: O.events, held: O.held.size, learn: O.learn };
    },
    log: n => (n ? O.log.slice(-n) : O.log.slice()).map(e => Object.assign({}, e, { m: e.m ? [...e.m] : null })),
    // the mapping: read (a copy), or put in its place (a mapping or its JSON; the problems found)
    map(j) { if (j === undefined) return O.map ? copy(O.map) : normMap({ out: 1 }).map; if (!O.map) load(); const bad = importMap(j); render(true); return bad; },
    midiIn: (bytes, at) => midiIn(bytes, at), oscIn: m => oscIn(m), oscFx: v => oscFx(v),
    learn: id => { O.learn = typeof id === 'string' ? id : ''; O.dirty = true; return O.learn; },
    changed: () => { O.dirty = true; },
    // for tests: one step now (the interval's), the slots ({ id: slot })
    step: () => step(), slots: () => Object.fromEntries([...O.slots].filter(([, S]) => !S.gone).map(([id, S]) => [id, S.slot])),
  };
})();

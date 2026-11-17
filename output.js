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
  const SRCS = ['head', 'hand', 'tracker', 'item', 'dist'], VALS = ['x', 'y', 'z', 'yaw', 'pitch', 'roll', 'speed', 'vx', 'vy', 'vz', 'acc', 'spin', 'd'];
  const MIDI_IN = ['note', 'cc', 'pc', 'start', 'stop', 'continue'];
  const OPT0 = { midi: false, midiOut: '', midiIn: '', osc: false, oscTrk: false, all: false, echo: false, people: false, peopleWhere: 'room', items: false, clock: false, noteLen: 100,
    clockOut: false, bar: 4, tempo: 120 };
  const newId = () => { let s = ''; for (const b of crypto.getRandomValues(new Uint8Array(6))) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]; return s; };
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  function normOpt(o) {
    const r = Object.assign({}, OPT0);
    if (!o || typeof o !== 'object') return r;
    for (const k of ['midi', 'osc', 'oscTrk', 'all', 'echo', 'people', 'items', 'clock', 'clockOut']) r[k] = o[k] === true;
    r.bar = isInt(o.bar, 1, 16) ? o.bar : 4;
    r.tempo = isNum(o.tempo, 20, 300) ? Math.round(o.tempo * 100) / 100 : 120;
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
    const midi = x.midi ? normMidi(x.midi) : null;
    if (midi === undefined) return why(`stream ${x.id}: its MIDI`);
    const osc = x.osc === undefined || x.osc === '' || x.osc === null ? '' : ADDR_RE.test(x.osc) && !x.osc.includes('//') ? x.osc : undefined;
    if (osc === undefined) return why(`stream ${x.id}: its OSC address`);
    return { id: x.id, on: x.on !== false, name: str(x.name, 40), src, v, min, max, curve: x.curve === 'inv' ? 'inv' : 'lin', smooth: isNum(x.smooth, 0, 0.95) ? x.smooth : 0,
      hz: isNum(x.hz, 1, 60) ? Math.round(x.hz) : 15, midi, osc };
  }
  // a stream's MIDI: { ch, cc, wide? } (a controller; wide: 14-bit, cc and cc + 32, only for cc 0 to 31) or { ch, note, at?,
  // vel?, val? } (a note as the value crosses at upward); undefined: a bad one
  function normMidi(m) {
    if (typeof m !== 'object' || !isInt(m.ch, 1, 16) || (m.cc === undefined) === (m.note === undefined)) return undefined;
    if (m.cc !== undefined) {
      if (!isInt(m.cc, 0, 127) || (m.wide !== undefined && m.wide !== false && !(m.wide === true && m.cc <= 31))) return undefined;
      return Object.assign({ ch: m.ch, cc: m.cc }, m.wide === true ? { wide: true } : {});
    }
    if (!isInt(m.note, 0, 127) || (m.at !== undefined && !isNum(m.at, 0.01, 0.99)) || (m.vel !== undefined && m.vel !== 'speed') || (m.val !== undefined && !isInt(m.val, 1, 127))) return undefined;
    const r = { ch: m.ch, note: m.note };
    for (const k of ['at', 'vel', 'val']) if (m[k] !== undefined) r[k] = m[k];
    return r;
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
    clock: { pos: 0, run: null, last: 0, iv: [], bpm: 0, at: 0, bar: 0, sentAt: -1e9, heard: -1e9, force: false },
    co: { run: false, bt: null, bar: 4, i: 0, last: 0, logAt: 0, ticks: 0, timer: 0 }, taps: [],
    ss: new Map(), ssBad: 0, ssList: null, lidN: 0, frameT: -1e9, tempoOn: false, ssSig: '', kin: new Map(), kinAt: -1e9, raf: 0, snotes: new Map(), tries: [], tryL: new Map(), rev: undefined, dirty: true, renderAt: 0, liveAt: 0, logSig: '', secs: {},
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
    coStop('MIDI off');
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
    for (const L of [...O.snotes.keys()]) streamOff(L, why);
  }
  // MIDI in (a port's message, or HOST.out.midiIn for tests; at: the room's ms of it, default now)
  function midiIn(data, at) {
    if (!O.on || !data || !data.length) return;
    const b = [...data].map(x => x & 255), s = b[0], t = Number.isFinite(at) ? at : rnow();
    if (s === 0xF8) { if (opt().clock) clockTick(t); return; }   // (24 a beat: never logged one by one)
    if (s === 0xF2 && b.length >= 3) {   // (Song Position Pointer: sixteenths from the song's start; a beat is 24 ticks, a sixteenth 6)
      const n = (b[1] & 127) | ((b[2] & 127) << 7);
      O.clock.pos = n * 6; O.clock.force = true;
      note('in', 'midi', 'song position ' + n + ' (sixteenths)', b);
      return;
    }
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
    if (m.midi === 'continue') { O.clock.run = true; O.clock.force = true; }
    if (m.midi === 'stop') { O.clock.run = false; if (opt().clock) clockStop(); }
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
  // MIDI clock to the room's beat (off by default): bpm from the median of the last 48 tick intervals; the ticks counted
  // from Start (a downbeat: the next tick is the bar's first) or a Song Position Pointer, else from the first tick heard; at
  // every beat the room's beat written with at = the latest downbeat (Beats a bar: bar) when it moved by 0.5 bpm or the
  // downbeat is 20 ms off, at most once a second (at once after Start, Continue or a song position); after Stop, nothing
  // until Start or Continue
  function clockStart() { Object.assign(O.clock, { pos: 0, run: true, last: 0, iv: [], force: true }); }   // (the tempo measured afresh: it may have changed while stopped)
  const clockLeads = () => !!(O.on && opt().clock && performance.now() - O.clock.heard < 1500);
  function clockTick(t) {
    const K = O.clock;
    K.heard = performance.now();
    if (K.last) { const d = t - K.last; if (d > 0 && d < 1000) { K.iv.push(d); if (K.iv.length > 48) K.iv.shift(); } else K.iv = []; }
    K.last = t;
    const pos = K.pos, bar = opt().bar;
    K.pos++;
    if (pos % 24 !== 0 || K.run === false || K.iv.length < 12) return;
    const s = K.iv.slice().sort((a, b) => a - b), med = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    const bpm = Math.round(6000000 / (24 * med)) / 100;
    if (bpm < 20 || bpm > 300) return;
    const down = t - (pos % (24 * bar)) * med;   // (the latest downbeat)
    let off = Infinity;
    if (K.bpm) { const B = 24 * bar * med, d = down - K.at; off = Math.abs(d - Math.round(d / B) * B); }
    if (!K.force && K.bpm && K.bar === bar && Math.abs(bpm - K.bpm) < 0.5 && off <= 20) return;
    if (!K.force && performance.now() - K.sentAt < 1000) return;
    K.sentAt = performance.now(); K.bpm = bpm; K.at = down; K.bar = bar; K.force = false;
    act({ do: 'beat', bpm, at: Math.round(down), bar }, 'MIDI clock');
  }
  function clockStop() {
    const K = O.clock;
    K.run = false; K.last = 0;
    if (!K.bpm) return;
    K.bpm = 0; K.sentAt = -1e9;
    act({ do: 'beat', bpm: 0 }, 'MIDI stop');
  }
  // the room's beat as the studio has applied it ({ bpm, at, bar, by }; a beat without bar: 4), or null
  function roomBeat() {
    let b = null;
    try { b = O.api && typeof O.api.beat === 'function' ? O.api.beat() : null; } catch (e) { b = null; }
    if (!b || !isNum(b.bpm, 20, 300) || !Number.isFinite(b.at)) return null;
    return { bpm: b.bpm, at: b.at, bar: isInt(b.bar, 1, 16) ? b.bar : 4, by: typeof b.by === 'string' ? b.by : '' };
  }

  // ---------------------------------------------------------- the room's own tempo --
  // Tempo: the room as master (Start writes the beat with its downbeat at the next 10 ms; Tap: 4 taps or more, the median)
  function tempoStart(why) {
    const at = Math.ceil(rnow() / 10) * 10;
    O.tempoOn = true;
    return act({ do: 'beat', bpm: opt().tempo, at, bar: opt().bar }, why || 'Tempo');
  }
  function tempoStop() { O.tempoOn = false; return act({ do: 'beat', bpm: 0 }, 'Tempo'); }
  // a new tempo or bar while the Tempo part leads: from the latest downbeat, at the new rate
  function tempoAgain() {
    const b = roomBeat();
    if (!O.tempoOn || !b || clockLeads()) return;
    const B = 60000 / b.bpm * b.bar, d = rnow() - b.at, down = b.at + Math.floor(d / B) * B;
    act({ do: 'beat', bpm: opt().tempo, at: Math.round(down), bar: opt().bar }, 'Tempo');
  }
  function tap(t) {
    const T = O.taps, now = Number.isFinite(t) ? t : performance.now();
    if (T.length && now - T[T.length - 1] > 2000) T.length = 0;
    T.push(now);
    if (T.length > 9) T.shift();
    if (T.length < 4) { say(`Tap ${4 - T.length} more time${T.length === 3 ? '' : 's'}.`); return 0; }
    const iv = T.slice(1).map((x, i) => x - T[i]).sort((a, b) => a - b), med = iv.length % 2 ? iv[(iv.length - 1) / 2] : (iv[iv.length / 2 - 1] + iv[iv.length / 2]) / 2;
    const bpm = clamp(Math.round(6000000 / med) / 100, 20, 300);
    opt().tempo = bpm; save(); tempoAgain();
    say(`Tapped: ${bpm.toFixed(2)} bpm.`);
    return bpm;
  }

  // ------------------------------------------------------------ MIDI clock out --
  // while the room has a beat: 24 clock bytes a beat on the output port, each with Web MIDI's timestamp (performance.now()'s
  // ms, from the room's: ts = perf + (room ms - the room's now)), a scheduler every 25 ms looking 100 ms ahead; a beat that
  // appears, or whose downbeat moves by more than a tick (another writer): Stop, Song Position (the bar's start) and Start
  // at the next downbeat; a tempo change goes on at the new rate from where it is; the beat gone: Stop
  const CO_AHEAD = 100;
  function midiAt(bytes, ts) {
    const M = O.midi;
    if (!opt().midi || !M.out) return false;
    try { M.out.send(bytes, ts); return true; } catch (e) { return false; }
  }
  function coStop(why) {
    const CO = O.co;
    if (!CO.run) return;
    CO.run = false; CO.bt = null;
    if (midiAt([0xFC], performance.now())) note('out', 'midi', 'clock out: Stop (' + why + ')', [0xFC]);
  }
  function coBegin(bt, now, perf) {
    const CO = O.co, tk = 60000 / bt.bpm / 24, BT = 24 * bt.bar;
    const i = Math.ceil((now + 20 - bt.at) / (tk * BT)) * BT, bars = i / BT, six = bt.bar * 4, most = Math.floor(16383 / six) + 1;
    const sp = (((bars % most) + most) % most) * six, ts = perf + (bt.at + i * tk - now);
    if (CO.run) midiAt([0xFC], perf);
    midiAt([0xF2, sp & 127, (sp >> 7) & 127], perf);
    midiAt([0xFA], ts);
    note('out', 'midi', `clock out: ${CO.run ? 'Stop, ' : ''}song position ${sp}, Start at the next downbeat (${bt.bpm} bpm, ${bt.bar} a bar)`, [0xF2, sp & 127, (sp >> 7) & 127]);
    Object.assign(CO, { run: true, bt, bar: bt.bar, i, last: bt.at + (i - 1) * tk });
  }
  function coStep() {
    if (!O.on) return;
    const CO = O.co, M = O.midi, bt = opt().midi && opt().clockOut && M.out ? roomBeat() : null;
    if (!bt) { coStop(!opt().clockOut || !opt().midi ? 'off' : !M.out ? 'no output port' : 'the room\'s beat stopped'); return; }
    const now = rnow(), perf = performance.now(), tk = 60000 / bt.bpm / 24;
    if (!CO.run) coBegin(bt, now, perf);
    else if (CO.bt.bpm !== bt.bpm || CO.bt.at !== bt.at || CO.bar !== bt.bar) {
      // where the downbeat stands before the last tick sent, on the old grid and on the new one
      const o = CO.bt, Bo = 60000 / o.bpm * o.bar, Bn = 60000 / bt.bpm * bt.bar;
      const Do = o.at + Math.floor((CO.last - o.at) / Bo) * Bo, Dn = bt.at + Math.floor((CO.last - bt.at) / Bn) * Bn, d = Do - Dn;
      if (CO.bar !== bt.bar || Math.abs(d - Math.round(d / Bn) * Bn) > tk) coBegin(bt, now, perf);
      else { CO.i = Math.floor((CO.last - bt.at) / tk + 0.5) + 1; CO.bt = bt; }
    }
    for (let n = 0; bt.at + CO.i * tk < now + CO_AHEAD && n < 64; n++) {
      const r = bt.at + CO.i * tk;
      if (r > CO.last) { midiAt([0xF8], perf + (r - now)); CO.ticks++; CO.last = r; }
      CO.i++;
    }
    if (perf - CO.logAt > 1000) { CO.logAt = perf; note('out', 'midi', `clock out ${bt.bpm.toFixed(2)} bpm`, null); }
  }
  const coLoop = () => { const M = O.midi, n = p => String((p && p.name) || '').trim().toLowerCase(); return !!(opt().clock && opt().clockOut && M.out && M.inp && n(M.out) === n(M.inp)); };

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
    else if (addr === '/studio/beat' || addr === '/studio/bar') { used = true; oscBeat(addr === '/studio/bar', args); }
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

  // /studio/beat f bpm [i bar]: each a beat (the bar's phase kept from the room's beat as it stands); /studio/bar f bpm [i
  // bar]: each a downbeat
  function oscBeat(down, args) {
    const bpm = typeof args[0] === 'number' ? args[0] : NaN, bar = typeof args[1] === 'number' && isInt(Math.round(args[1]), 1, 16) ? Math.round(args[1]) : undefined;
    const now = rnow(), b = roomBeat(), n = bar || (b ? b.bar : 4);
    let at = now;
    if (!down && b && Number.isFinite(bpm) && bpm > 0) { const k = Math.round((now - b.at) * b.bpm / 60000); at = now - (((k % n) + n) % n) * 60000 / bpm; }
    act(Object.assign({ do: 'beat', bpm, at: Math.round(at) }, bar ? { bar } : {}), 'OSC ' + (down ? '/studio/bar' : '/studio/beat'));
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
    note('in', 'room', `${why}: ${a.do}${a.id ? ' ' + a.id : ''}${a.do === 'beat' ? ' ' + a.bpm + ' bpm' + (a.bar ? ', ' + a.bar + ' a bar' : '') : ''}${r.ok ? '' : ' refused (' + r.why + ')'}`, null);
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
    if (O.on && ev && ev.ev === 'stream' && typeof ev.id === 'string') { tryStream(ev); return; }
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
  // ------------------------------------------------------------- kinematics --
  // a moving thing's samples (t ms, p, q): its velocity and turning speed over the last ~100 ms, its acceleration from the
  // velocities ~100 ms apart (a frame that drew nothing new is no stop: a pose counts as standing still once unchanged
  // for 60 ms)
  const KWIN = 100, KKEEP = 500;
  const kinNew = () => ({ h: [] });
  const sameP = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  const sameQ = (a, b) => (!a && !b) || (!!a && !!b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]);
  function before(H, at, need, end) { for (let i = (end === undefined ? H.length : end) - 1; i >= 0; i--) if (H[i].t <= at && (!need || H[i][need])) return H[i]; return null; }
  function kinPush(K, t, p, q) {
    const H = K.h, last = H[H.length - 1];
    if (last && (t <= last.t || (sameP(p, last.p) && sameQ(q, last.q) && t - last.t < 60))) return;
    if (last && t - last.t > KKEEP) H.length = 0;
    const s = { t, p: p.slice(0, 3), q: q ? q.slice(0, 4) : null, v: null, w: null }, o = before(H, t - KWIN) || H[0];
    if (o) { const dt = (t - o.t) / 1000; s.v = [0, 1, 2].map(i => (p[i] - o.p[i]) / dt); if (s.q && o.q) s.w = angle(s.q, o.q) / dt; }
    H.push(s);
    while (H.length > 2 && t - H[0].t > KKEEP) H.shift();
  }
  // { v: [vx, vy, vz], speed, acc, spin } (m/s, m/s², degrees a second; acc and spin null until known), or null
  function kinOf(K) {
    const H = K && K.h, s = H && H[H.length - 1];
    if (!s || !s.v) return null;
    const o = before(H, s.t - KWIN, 'v', H.length - 1);
    return { v: s.v, speed: Math.hypot(s.v[0], s.v[1], s.v[2]), acc: o ? Math.hypot(s.v[0] - o.v[0], s.v[1] - o.v[1], s.v[2] - o.v[2]) / ((s.t - o.t) / 1000) : null, spin: s.w };
  }
  // yaw, pitch and roll (degrees) of a turn: three.js's 'YXZ' order (yaw about y, pitch, then roll about where it looks)
  function ypr(q) {
    const [x, y, z, w] = q, m13 = 2 * (x * z + w * y), m23 = 2 * (y * z - w * x), m33 = 1 - 2 * (x * x + y * y), m21 = 2 * (x * y + w * z), m22 = 1 - 2 * (x * x + z * z), D = 180 / Math.PI;
    return { yaw: Math.atan2(m13, m33) * D, pitch: Math.asin(clamp(-m23, -1, 1)) * D, roll: Math.abs(m23) < 0.9999999 ? Math.atan2(m21, m22) * D : 0 };
  }
  // a pose's value (P a sample { p, q }, k its kinematics), or null
  function kinVal(v, P, k) {
    if (v === 'x' || v === 'y' || v === 'z') return P.p['xyz'.indexOf(v)];
    if (v === 'yaw' || v === 'pitch' || v === 'roll') return P.q ? ypr(P.q)[v] : null;
    if (!k) return null;
    if (v === 'vx' || v === 'vy' || v === 'vz') return k.v['xyz'.indexOf(v[1])];
    return v === 'speed' ? k.speed : v === 'acc' ? k.acc : v === 'spin' ? k.spin : null;
  }

  // ------------------------------------------------------------- a stream out --
  const liveNew = () => ({ at: 0, y: null, s: null, x: null, vm: -1, gate: null, snd: null, spd: 0 });
  // one sample of a stream out: o its MIDI ({ ch, cc, wide? } or { ch, note, at?, vel?, val? }; null: none), s the value
  // scaled (0..1), y as measured, spd the thing's speed (m/s: a note's velocity), addr its OSC address ('' none). A
  // controller only when its value changes (14-bit: cc the high 7 bits, cc + 32 the low); a note as s crosses at upward
  // (the first sample only says where it stands), off below at - 0.05 or after 2 s held, its gate on addr + '/gate'
  function emit(L, o, s, y, spd, addr, t, text) {
    if (o && o.cc !== undefined && opt().midi) {
      const c = 0xB0 | (o.ch - 1), v = Math.round(s * (o.wide ? 16383 : 127));
      if (v !== L.vm && (o.wide ? midiSendQuiet([c, o.cc, v >> 7]) && midiSendQuiet([c, o.cc + 32, v & 127]) : midiSendQuiet([c, o.cc, v]))) L.vm = v;
    }
    if (o && o.note !== undefined) {
      const at = o.at === undefined ? 0.5 : o.at;
      if (L.gate === null) L.gate = s >= at;   // (the first sample: where it stands, no note)
      else if (!L.gate && s >= at) {
        L.gate = true;
        const vel = o.vel === 'speed' ? 1 + Math.round(126 * Math.min(1, (spd || 0) / 3)) : o.val || 100, off = [0x80 | (o.ch - 1), o.note, 0];
        if (midiSend([0x90 | (o.ch - 1), o.note, vel], `note ${o.note} on at ${vel}, channel ${o.ch} (${text})`)) { L.snd = { at: t, off, text: `note ${o.note} off, channel ${o.ch}` }; O.snotes.set(L, 1); }
        if (addr && opt().osc) oscOut(addr + '/gate', 'i', [1], null);
      } else if (L.gate && s < at - 0.05) {
        L.gate = false;
        streamOff(L, '');
        if (addr && opt().osc) oscOut(addr + '/gate', 'i', [0], null);
      }
      if (L.snd && t - L.snd.at > 2000) streamOff(L, 'held 2 s');
    }
    if (addr && opt().osc) oscOut(addr, 'ff', [s, y], null);
  }
  function streamOff(L, why) {
    O.snotes.delete(L);
    if (!L.snd) return;
    const S = L.snd;
    L.snd = null;
    midiSend(S.off, S.text + (why ? ' (' + why + ')' : ''));
  }
  // a stream's value as measured (m, degrees, m/s, m/s², degrees a second), or null when its source is not there
  function measure(r, L, t) {
    const s = r.src;
    if (s.k === 'dist') {
      const a = pointOf(s.a), b = pointOf(s.b);
      if (!a || !b) return null;
      return s.flat ? Math.hypot(a.p[0] - b.p[0], a.p[2] - b.p[2]) : Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]);
    }
    const P = pointOf(s);
    if (!P || !Array.isArray(P.p) || P.p.length < 3) { L.kin = null; return null; }
    const q = Array.isArray(P.q) && P.q.length === 4 ? P.q : null;
    if (!L.kin) L.kin = kinNew();
    kinPush(L.kin, s.k === 'item' && t - O.frameT < 200 ? O.frameT : t, P.p, q);   // (an item is drawn at its frame's time)
    const k = kinOf(L.kin);
    L.spd = k ? k.speed : 0;
    return kinVal(r.v, { p: P.p, q }, k);
  }
  function streamsStep(t) {
    for (const r of O.map.streams) {
      let L = O.live.get(r.id);
      if (!L) O.live.set(r.id, (L = liveNew()));
      if (!r.on) { streamOff(L, 'off'); continue; }
      const hz = Math.min(r.hz, usesPerson(r.src) ? 15 : 60);
      if (t - L.at < 1000 / hz - 1) continue;
      L.at = t;
      const x = measure(r, L, t);
      if (x === null || !Number.isFinite(x)) { L.x = null; continue; }
      scaleIn(L, r, x);
      emit(L, r.midi, L.s, L.y, L.spd, r.osc, t, r.name || r.id);
    }
  }
  // smoothed (y += (1 - smooth)(x - y)) and scaled to 0..1 (r: { min, max, curve, smooth })
  function scaleIn(L, r, x) {
    L.x = x;
    L.y = L.y === null ? x : L.y + (1 - r.smooth) * (x - L.y);
    const s = clamp((L.y - r.min) / (r.max - r.min), 0, 1);
    L.s = r.curve === 'inv' ? 1 - s : s;
  }
  // (streams: sent without a log line each, or the log would hold nothing else; counted in the row's live value)
  function midiSendQuiet(b) { const M = O.midi; if (!opt().midi || !M.out) return false; try { M.out.send(b); return true; } catch (e) { return false; } }

  // ----------------------------------------------------- the scene's streams --
  // an item's stream entries (layout.json's stream, set on the studio's cards; HOST.cur.out.list()), checked again here
  // (tools/output/SPEC.md, v158 section 2): its value measured, its range (default below), smoothed, at its rate, as a CC,
  // a 14-bit CC, a threshold note and OSC (its own address or /studio/item|cube/<id>/<v>)
  const SV = { x: [-3, 3], y: [0, 2.5], z: [-3, 3], yaw: [-180, 180], pitch: [-90, 90], roll: [-180, 180], speed: [0, 3], vx: [-3, 3], vy: [-3, 3], vz: [-3, 3], acc: [0, 20], spin: [0, 720],
    size: [0.5, 2], shown: [0, 1], clip: [0, 1], path: [0, 1], motion: [0, 1], near: [0, 4], count: [0, 4] };
  const SV_STATE = { size: 1, shown: 1, clip: 1, path: 1, motion: 1, near: 1, count: 1 }, SV_SLOW = { near: 1, count: 1 }, SV_ITEM = 8, SV_SCENE = 64;
  function normScene(e, k) {
    if (!e || typeof e !== 'object' || !SV[e.v] || (e.v === 'count' && k !== 'c')) return null;
    const D = SV[e.v];
    if ((e.min !== undefined && !isNum(e.min, -1e6, 1e6)) || (e.max !== undefined && !isNum(e.max, -1e6, 1e6))) return null;
    const r = { v: e.v, min: e.min === undefined ? D[0] : e.min, max: e.max === undefined ? D[1] : e.max };
    if (r.min === r.max || (e.curve !== undefined && e.curve !== 'inv') || (e.smooth !== undefined && !isNum(e.smooth, 0, 0.95)) || (e.hz !== undefined && !isNum(e.hz, 1, 60))) return null;
    Object.assign(r, { curve: e.curve === 'inv' ? 'inv' : 'lin', smooth: e.smooth || 0, hz: Math.min(e.hz === undefined ? 30 : Math.round(e.hz), SV_SLOW[e.v] ? 15 : 60) });
    if (e.ch !== undefined && !isInt(e.ch, 1, 16)) return null;
    if (e.cc !== undefined || e.note !== undefined) { r.o = normMidi(Object.assign({ ch: e.ch || 1 }, ...['cc', 'wide', 'note', 'at', 'vel', 'val'].filter(f => e[f] !== undefined).map(f => ({ [f]: e[f] })))); if (!r.o) return null; }
    else if (e.wide !== undefined) return null;
    else r.o = null;
    if (e.osc !== undefined) { if (typeof e.osc !== 'string' || !ADDR_RE.test(e.osc) || e.osc.includes('//')) return null; r.osc = e.osc; }
    return r;
  }
  const svAddr = (id, k, r) => r.osc || `/studio/${k === 'c' ? 'cube' : 'item'}/${id}/${r.v}`;
  // the entries of the items as listed now (a bad one, a duplicate or one past the limits dropped and counted)
  function sceneStreams() {
    const keep = new Map();
    let bad = 0, n = 0;
    for (const x of itemList()) {
      if (!Array.isArray(x.stream) || x.k === 'q') continue;
      const dup = new Set();
      x.stream.forEach((e, i) => {
        const r = i < SV_ITEM && n < SV_SCENE ? normScene(e, x.k) : null;
        if (!r) { bad++; return; }
        const key = x.id + '|' + JSON.stringify(r);
        if (dup.has(key)) return;
        dup.add(key); n++;
        const S = O.ss.get(key) || { key, id: x.id, r, L: liveNew(), lid: 'sc' + (++O.lidN) };
        Object.assign(S, { k: x.k, name: x.name || x.id });
        keep.set(key, S);
      });
    }
    for (const [key, S] of O.ss) if (!keep.has(key)) streamOff(S.L, 'gone');
    const sig = [...keep.keys()].join(',') + '|' + bad;
    if (sig !== O.ssSig) { O.ssSig = sig; O.dirty = true; }
    O.ss = keep; O.ssBad = bad;
  }
  // each item's pose sampled every frame (requestAnimationFrame's own time; a hidden tab: the step's, 5 a second)
  function kinSample(t) {
    O.kinAt = t;
    if (!O.api) return;
    const ids = new Set([...O.ss.values()].map(S => S.id));
    for (const id of O.kin.keys()) if (!ids.has(id)) O.kin.delete(id);
    for (const id of ids) {
      let P = null;
      try { P = O.api.pose(id); } catch (e) { P = null; }
      if (!P || !Array.isArray(P.p) || P.p.length < 3 || !P.p.every(Number.isFinite)) { O.kin.delete(id); continue; }
      let K = O.kin.get(id);
      if (!K) O.kin.set(id, (K = kinNew()));
      kinPush(K, t, P.p, Array.isArray(P.q) && P.q.length === 4 && P.q.every(Number.isFinite) ? P.q : null);
    }
  }
  function kinFrame(ts) {
    if (!O.on) return;
    O.raf = requestAnimationFrame(kinFrame);
    O.frameT = ts;
    if (O.ss.size) kinSample(ts);
  }
  function sceneVal(S, K, k) {
    const v = S.r.v;
    if (SV_STATE[v]) {
      if (typeof O.api.value !== 'function') return null;
      let x = null;
      try { x = O.api.value(S.id, v); } catch (e) { x = null; }
      return x === true ? 1 : x === false ? 0 : typeof x === 'number' ? x : null;
    }
    const s = K && K.h[K.h.length - 1];
    return s ? kinVal(v, s, k) : null;
  }
  function sceneStep(t) {
    if (!O.api) return;
    let rev;
    try { rev = typeof O.api.rev === 'function' ? O.api.rev() : undefined; } catch (e) { rev = undefined; }
    if (rev !== O.rev) { O.rev = rev; O.listAt = 0; }   // (the scene changed: read again at once)
    itemList();
    if (O.ssList !== O.list) { O.ssList = O.list; sceneStreams(); }
    if (!O.ss.size) return;
    if (t - O.kinAt > 200) kinSample(t);   // (no frames: a hidden tab)
    for (const S of O.ss.values()) {
      const r = S.r, L = S.L;
      if (t - L.at < 1000 / r.hz - 1) continue;
      L.at = t;
      const K = O.kin.get(S.id), k = kinOf(K), x = sceneVal(S, K, k);
      if (x === null || !Number.isFinite(x)) { L.x = null; continue; }
      scaleIn(L, r, x);
      emit(L, r.o, L.s, L.y, k ? k.speed : 0, svAddr(S.id, S.k, r), t, `${S.name} ${r.v}`);
    }
  }
  // a card's Try (the effect send with ev 'stream' and try: 1): with a value (s, 0..1) that value once; without, a sweep
  // 0 to 1 to 0 over 1 s, for the item's entries of that value
  function tryStream(ev) {
    const x = itemList().find(i => i.id === ev.id), k = ev.k || (x && x.k) || 'o';
    // (the event's own entries first: the item list is cached up to 1 s, so an entry just added or changed is not in it yet)
    const from = Array.isArray(ev.stream) && ev.stream.some(e => e && SV[e.v]) ? ev.stream
      : Array.isArray(ev.send) && ev.send.some(e => e && SV[e.v]) ? ev.send : x && Array.isArray(x.stream) ? x.stream : [];
    const list = from.map(e => normScene(e, k)).filter(r => r && (!ev.v || r.v === ev.v));
    note('in', 'room', `Try: ${ev.name || ev.id} ${ev.v || ''}${list.length ? '' : ' (no such stream here)'}`, null);
    const t = performance.now();
    for (const r of list) {
      const addr = svAddr(ev.id, k, r);
      if (isNum(ev.s, 0, 1)) {
        let L = O.tryL.get(addr);
        if (!L) O.tryL.set(addr, (L = liveNew()));
        emit(L, r.o, ev.s, r.min + ev.s * (r.max - r.min), 3 * ev.s, addr, t, 'Try');
      } else O.tries.push({ r, addr, t0: t, L: Object.assign(liveNew(), { gate: false }) });
    }
  }
  function triesStep(t) {
    O.tries = O.tries.filter(T => {
      const u = (t - T.t0) / 1000, top = u >= 0.5 && !T.top, s = u >= 1 ? 0 : top ? 1 : 1 - Math.abs(2 * u - 1);
      if (u < 1 && !top && t - T.L.at < 1000 / T.r.hz - 1) return true;
      if (top) T.top = true;   // (the sweep's top always sent)
      T.L.at = t;
      emit(T.L, T.r.o, s, T.r.min + s * (T.r.max - T.r.min), 3 * s, T.addr, t, 'Try');
      if (u >= 1) streamOff(T.L, '');
      return u < 1;
    });
  }

  // ----------------------------------------------------------------- the step --
  function step() {
    if (!O.on) return;
    const t = performance.now(), c = C();
    if (!c || !c.code) { stop('left the room'); return; }
    // (the studio's API: HOST.cur.out, present from the studio's first frame; a new story or a new studio: listened to again)
    const api = HOST.cur && HOST.cur.out && typeof HOST.cur.out.listen === 'function' ? HOST.cur.out : null;
    if (api !== O.api) {
      if (O.unlisten) try { O.unlisten(); } catch (e) { /* gone */ }
      O.unlisten = null; O.api = api; O.listAt = 0; O.items.clear(); O.dirty = true; O.ssList = null; O.kin.clear();
      for (const S of O.ss.values()) streamOff(S.L, 'another scene');
      O.ss.clear();
      if (api) try { O.unlisten = api.listen(onEvent); } catch (e) { O.unlisten = null; }
      note('in', 'room', api ? 'the studio scene: listening' : 'no studio scene here: people and trackers only', null);
    }
    slotsStep(t);
    peopleStep(t);
    itemsStep(t);
    streamsStep(t);
    sceneStep(t);
    triesStep(t);
    // (a note held 2 s goes off here too: one whose value went (hidden, no pose) or a one-shot Try emits no more)
    for (const L of [...O.snotes.keys()]) if (L.snd && t - L.snd.at > 2000) streamOff(L, 'held 2 s');
    oscFlush();
    if (opt().osc) { oscPing(false); if (opt().oscTrk && O.osc.st && O.osc.st.trk === 'off') oscCfg(false); }
    if (O.dirty && t - O.renderAt > 250) render();
    else if (t - O.renderAt > 1000) render();
    if (t - O.liveAt > 250) liveRender(t);
  }

  // --------------------------------------------------------------- the overlay --
  const OUT_CSS = `
#out { position: fixed; right: 0; top: calc(60px + env(safe-area-inset-top, 0px)); bottom: 0; width: min(420px, 100vw); z-index: 9; overflow-y: auto; box-sizing: border-box;
  padding: 10px 12px 24px; background: rgba(4, 10, 20, 0.97); color: #e7eef8; font: 13px/1.4 B612, "Segoe UI", "Helvetica Neue", Arial, sans-serif; border-left: 1px solid rgba(149, 166, 189, 0.3); }
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
        ${['status', 'midi', 'tempo', 'osc', 'events', 'people', 'items', 'streams', 'incoming', 'io'].map(k => `<section data-sec="${k}"></section>`).join('')}
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
    const S = { status: secStatus, midi: secMidi, tempo: secTempo, osc: secOsc, events: secEvents, people: secPeople, items: secItems, streams: secStreams, incoming: secIncoming, io: secIo };
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
    const sc = new Map([...O.ss.values()].map(S => [S.lid, S]));
    for (const sp of O.el.querySelectorAll('[data-live]')) {
      const id = sp.dataset.live, S = sc.get(id), L = S ? S.L : O.live.get(id), r = S ? S.r : O.map.streams.find(x => x.id === id), o = S ? r.o : r && r.midi;
      const txt = !r || (!S && !r.on) ? 'off' : !L || L.x === null || L.y === null ? 'no value' : `${L.y.toFixed(ANGLES[r.v] ? 1 : 3)} → ${L.s.toFixed(2)}${o && opt().midi ? o.note !== undefined ? (L.snd ? ' (note on)' : '') : ' (' + Math.max(0, L.vm) + ')' : ''}`;
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
    const K = O.clock, CO = O.co, inW = !o.clock ? '' : clockLeads() ? `Clock in: ${K.bpm ? K.bpm.toFixed(2) + ' bpm, ' : ''}leading the room's beat.` : 'Clock in: waiting for MIDI clock on the input.';
    const outW = !o.clockOut ? '' : CO.run ? `Clock out: ${CO.bt.bpm.toFixed(2)} bpm, ${CO.bt.bar} a bar.` : roomBeat() ? 'Clock out: starting...' : 'Clock out: waiting for the room\'s beat (the Tempo part, MIDI clock in or OSC).';
    return `<h3>MIDI</h3><div class="o-btns">${onOff(o.midi, 'MIDI', 'midi')}<button type="button" data-o="test"${o.midi && M.out ? '' : ' disabled'}>Test note</button></div>
      <div class="o-btns">${sel('midiOut', M.outs, M.out, 'Output')}${sel('midiIn', M.ins, M.inp, 'Input')}</div><p class="o-mute">${esc(st)}</p>
      <div class="o-btns">${onOff(o.clock, 'MIDI clock to the room\'s beat', 'clock', 'The input\'s MIDI clock sets the room\'s beat (Start: a downbeat; song position; Stop takes it away), which motions and loops on the beat follow')}${onOff(o.clockOut, 'MIDI clock out', 'clockOut', 'The room\'s beat as MIDI clock on the output: 24 a beat, Start at a downbeat, Stop when it goes')}
      <label>Beats a bar <input type="number" min="1" max="16" step="1" data-oc="bar" value="${o.bar}" aria-label="Beats a bar"></label></div>
      ${inW || outW ? `<p class="o-mute">${esc([inW, outW].filter(Boolean).join(' '))}</p>` : ''}${coLoop() ? '<p class="o-warn">A loop: the input and output may be the same cable (their ports have the same name).</p>' : ''}`;
  }
  // the room's own tempo: the room as master (not while MIDI clock in leads)
  function secTempo() {
    const o = opt(), lead = clockLeads(), b = roomBeat(), dis = lead ? ' disabled' : '';
    const by = b && b.by ? (C() && b.by === C().id ? 'this page' : whoOf(b.by).name || 'someone') : '';
    const now = b ? `The room's beat: ${b.bpm.toFixed(2)} bpm, ${b.bar} a bar${by ? ', set by ' + by : ''}.` : O.api ? 'The room has no beat now.' : 'No studio scene here: the room\'s beat needs one.';
    return `<h3>Tempo</h3><div class="o-btns"><label>bpm <input type="number" min="20" max="300" step="0.01" data-oc="tempo" value="${o.tempo}" aria-label="Tempo (bpm)"${dis}></label>
      <label>Beats a bar <input type="number" min="1" max="16" step="1" data-oc="bar" value="${o.bar}" aria-label="Beats a bar (tempo)"${dis}></label>
      <button type="button" data-o="tap"${dis}>Tap</button><button type="button" class="o-go" data-o="tstart"${dis}>Start</button><button type="button" data-o="tstop"${dis}>Stop</button></div>
      <p class="o-mute">${esc(lead ? 'MIDI clock in leads the room\'s beat: turn MIDI clock to the room\'s beat off to set it here. ' + now : now)}</p>`;
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
  const VAL_SAY = { x: 'x', y: 'height (y)', z: 'z', yaw: 'yaw (degrees)', pitch: 'pitch (degrees)', roll: 'roll (degrees)', speed: 'speed (m/s)', vx: 'velocity along x (m/s)', vy: 'velocity up (m/s)',
    vz: 'velocity along z (m/s)', acc: 'acceleration (m/s²)', spin: 'turning speed (degrees a second)', d: 'distance (m)',
    size: 'size (its scale)', shown: 'shown (0 or 1)', clip: 'its clip (0 to 1)', path: 'its recorded path (0 to 1)', motion: 'its motion (0 to 1)', near: 'nearest person (m)', count: 'people inside' };
  const ANGLES = { yaw: 1, pitch: 1, roll: 1, spin: 1 };
  const midiText2 = o => (!o ? '' : o.cc !== undefined ? ` → ${o.wide ? '14-bit CC ' + o.cc + ' and ' + (o.cc + 32) : 'CC ' + o.cc} channel ${o.ch}`
    : ` → note ${o.note} at ${Math.round((o.at === undefined ? 0.5 : o.at) * 100)} %, velocity ${o.vel === 'speed' ? 'from its speed' : o.val || 100}, channel ${o.ch}`);
  const streamText = r => `${srcText(r.src)} · ${VAL_SAY[r.v]} · ${r.min} to ${r.max}${r.curve === 'inv' ? ' (inverted)' : ''}${r.smooth ? ', smoothed ' + r.smooth : ''}, ${r.hz}/s` +
    midiText2(r.midi) + (r.osc ? ` → OSC ${r.osc}` : '') + (!r.midi && !r.osc ? ' (sends nothing)' : '');
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
      <div class="o-btns"><button type="button" data-o="sadd"${O.map.streams.length >= ROWS || E ? ' disabled' : ''}>Add a stream</button></div>
      <h3>Streams from the scene</h3><p class="o-mute">Set on the studio's cards (an item's Streams): read only here, sent while MIDI or OSC is on.</p>
      <ul>${[...O.ss.values()].map(S => `<li><b>${esc(S.name)}</b> <span class="o-live" data-live="${S.lid}"></span><br><span>${esc(`${VAL_SAY[S.r.v]} · ${S.r.min} to ${S.r.max}${S.r.curve === 'inv' ? ' (inverted)' : ''}${S.r.smooth ? ', smoothed ' + S.r.smooth : ''}, ${S.r.hz}/s${midiText2(S.r.o)} → OSC ${svAddr(S.id, S.k, S.r)}`)}</span></li>`).join('')
        || `<li class="o-mute">${O.api ? 'None in this scene.' : 'No studio scene here.'}</li>`}</ul>${O.ssBad ? `<p class="o-warn">${O.ssBad} of the scene's stream entr${O.ssBad === 1 ? 'y' : 'ies'} could not be read here (dropped).</p>` : ''}`;
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
      <label>MIDI as</label><select data-f="mkind">${opts(['cc', 'wide', 'note'], !d.midi || d.midi.cc !== undefined ? (d.midi && d.midi.wide ? 'wide' : 'cc') : 'note', v => ({ cc: 'A controller (CC)', wide: 'A 14-bit controller (CC 0 to 31 and +32)', note: 'A note as it crosses a threshold' }[v]))}</select>
      <label>Controller or note</label><input type="number" min="0" max="127" step="1" data-f="mcc" value="${d.midi ? (d.midi.cc !== undefined ? d.midi.cc : d.midi.note) : 7}">
      <label>Threshold (%)</label><input type="number" min="1" max="99" step="1" data-f="mat" value="${Math.round(((d.midi && d.midi.at) || 0.5) * 100)}">
      <label>Velocity</label><select data-f="mvel">${opts(['fixed', 'speed'], d.midi && d.midi.vel === 'speed' ? 'speed' : 'fixed', v => (v === 'fixed' ? 'Fixed' : 'From its speed (0 to 3 m/s)'))}</select>
      <label>Velocity (fixed)</label><input type="number" min="1" max="127" step="1" data-f="mval" value="${(d.midi && d.midi.val) || 100}">
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
      const ch = n('mch'), mk = v('mkind') || 'cc', num = n('mcc');
      const midi = !ch ? null : mk === 'note' ? Object.assign({ ch, note: num, at: n('mat') / 100 }, v('mvel') === 'speed' ? { vel: 'speed' } : { val: n('mval') }) : Object.assign({ ch, cc: num }, mk === 'wide' ? { wide: true } : {});
      return { name: v('name') || '', src: s, v: s.k === 'dist' ? 'd' : v('v'), min: n('min'), max: n('max'), curve: v('curve'), smooth: n('smooth'), hz: n('hz'), midi, osc: (v('osc') || '').trim() };
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
    else if (['clock', 'all', 'echo', 'people', 'items', 'clockOut'].includes(a)) { o[a] = !o[a]; if (a === 'items') O.items.clear(); if (a === 'clock') { clockStart(); O.clock.run = null; } save(); if (a === 'clockOut') coStep(); }
    else if (a === 'tap') tap();
    else if (a === 'tstart') tempoStart();
    else if (a === 'tstop') tempoStop();
    else if (a === 'osc') { o.osc = !o.osc; save(); if (o.osc) oscPing(true); oscCfg(true); O.items.clear(); }
    else if (a === 'oscTrk') { o.oscTrk = !o.oscTrk; save(); oscCfg(true); }
    else if (a === 'son' || a === 'ion') { const r = (a === 'son' ? O.map.streams : O.map.incoming).find(x => x.id === arg); if (r) { r.on = !r.on; save(); } }
    else if (a === 'sdel' || a === 'idel') { const k = a === 'sdel' ? 'streams' : 'incoming'; if (O.live.has(arg)) streamOff(O.live.get(arg), 'removed'); O.map[k] = O.map[k].filter(x => x.id !== arg); O.live.delete(arg); O.inc.delete(arg); if (O.edit && O.edit.id === arg) O.edit = null; save(); }
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
    else if (k === 'bar') { const v = Math.round(Number(x.value)); if (v >= 1 && v <= 16) { o.bar = v; save(); tempoAgain(); } }
    else if (k === 'tempo') { const v = Number(x.value); if (v >= 20 && v <= 300) { o.tempo = Math.round(v * 100) / 100; save(); tempoAgain(); } }
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
    Object.assign(O, { on: true, phase: 'live', why: why || 'api', api: null, unlisten: null, events: 0, learn: '', edit: null, ssList: null, rev: undefined });
    O.clock = { pos: 0, run: null, last: 0, iv: [], bpm: 0, at: 0, bar: 0, sentAt: -1e9, heard: -1e9, force: false };
    O.osc = { relay: null, pinged: 0, st: null, sent: 0, got: 0, dropped: 0, cfgAt: 0, q: [] };
    c.outMark(true);
    pickCircle();
    show();
    O.vis = () => { O.dirty = true; render(); };
    quiet(() => document.addEventListener('visibilitychange', O.vis));
    O.timer = setInterval(step, 16);
    O.co = { run: false, bt: null, bar: 4, i: 0, last: 0, logAt: 0, ticks: 0, timer: setInterval(coStep, 25) };
    O.raf = requestAnimationFrame(kinFrame);
    if (opt().midi) midiOn();
    if (opt().osc) { oscPing(true); if (opt().oscTrk) setTimeout(() => { if (O.on) oscCfg(true); }, 500); }
    note('out', 'room', 'output page on (' + O.why + ')', null);
    return true;
  }
  function stop(why) {
    if (!O.on) return false;
    note('out', 'room', 'output page off (' + why + ')', null);
    releaseAll('stopped');
    coStop('stopped'); clearInterval(O.co.timer);
    if (O.raf) cancelAnimationFrame(O.raf);
    if (opt().osc && opt().oscTrk) C().oscCfg({ trk: false });
    oscFlush();
    midiOff();
    if (O.unlisten) try { O.unlisten(); } catch (e) { /* gone */ }
    clearInterval(O.timer); O.timer = 0;
    if (O.vis) document.removeEventListener('visibilitychange', O.vis);
    Object.assign(O, { on: false, phase: 'off', api: null, unlisten: null, vis: null, edit: null, learn: '' });
    O.slots.clear(); O.live.clear(); O.inc.clear(); O.items.clear(); O.ss.clear(); O.kin.clear(); O.tries = []; O.tryL.clear(); O.ssList = null; O.raf = 0; O.tempoOn = false;
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
        opt: O.map ? copy(opt()) : null, streams: O.map ? copy(O.map.streams) : [], incoming: O.map ? copy(O.map.incoming) : [], events: O.events, held: O.held.size, learn: O.learn,
        clock: { in: { bpm: O.clock.bpm, at: O.clock.at, bar: O.clock.bar, pos: O.clock.pos, run: O.clock.run, leads: clockLeads() }, out: { run: O.co.run, bpm: O.co.bt ? O.co.bt.bpm : 0, ticks: O.co.ticks, loop: O.on ? coLoop() : false }, tempo: O.on ? opt().tempo : 0, beat: roomBeat() },
        scene: [...O.ss.values()].map(S => ({ id: S.id, k: S.k, v: S.r.v, x: S.L.x, y: S.L.y, s: S.L.s, note: !!S.L.snd, kin: kinOf(O.kin.get(S.id)) })), sceneBad: O.ssBad, live: O.map ? Object.fromEntries([...O.live].map(([id, L]) => [id, { x: L.x, y: L.y, s: L.s, note: !!L.snd }])) : {} };
    },
    log: n => (n ? O.log.slice(-n) : O.log.slice()).map(e => Object.assign({}, e, { m: e.m ? [...e.m] : null })),
    // the mapping: read (a copy), or put in its place (a mapping or its JSON; the problems found)
    map(j) { if (j === undefined) return O.map ? copy(O.map) : normMap({ out: 1 }).map; if (!O.map) load(); const bad = importMap(j); render(true); return bad; },
    midiIn: (bytes, at) => midiIn(bytes, at), oscIn: m => oscIn(m), oscFx: v => oscFx(v),
    // the Tempo part (tests): a tap at t (performance.now()'s ms), Start, Stop; clock out's scheduler once now
    tap: t => tap(t), tempoStart: () => tempoStart(), tempoStop: () => tempoStop(), clockOutStep: () => coStep(),
    learn: id => { O.learn = typeof id === 'string' ? id : ''; O.dirty = true; return O.learn; },
    changed: () => { O.dirty = true; },
    // for tests: one step now (the interval's), the slots ({ id: slot })
    step: () => step(), slots: () => Object.fromEntries([...O.slots].filter(([, S]) => !S.gone).map(([id, S]) => [id, S.slot])),
  };
})();

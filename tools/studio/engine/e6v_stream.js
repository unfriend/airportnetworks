// ============================================================== STREAMS ON A CARD ==
// Values from the scene sent as MIDI and OSC (v158; the owner, 17 November 2026: "xyz plus velocity plus what else", then the
// scene's streams set on an item's card; tools/output/SPEC.md "v158" section 2 is the contract, tools/studio/SPEC.md "Streams
// on a card" the studio's part). An object's, a shape's, an empty's, a sound's or a cube's record may carry stream entries:
//   stream: [{ v, min, max, curve, smooth, hz, cc, wide, note, at, vel, val, ch, osc }]   (fields in this order, only those set)
// v what is measured (STREAM_V): where it is drawn and how it moves (the output page measures those itself from out.pose()),
// its state (out.value(), worked out here), people near it, and a cube's count of heads inside. min and max the range mapped
// to 0..1 (absent: the value's own, STREAM_RANGE); curve 'inv'; smooth 0..0.95; hz 1..60 (near and count at most 15); then
// cc (wide: 14-bit, cc 0..31) or note (at: its threshold, vel 'speed' or val its velocity), or neither (OSC only); ch 1..16;
// osc an address of its own (the send entries' rule). The output page (output.js) runs them; nothing of it is sent by the
// studio but a card's Try (the effect send with ev 'stream'). At most 8 an item and 64 a scene.
const STREAM_MAX = 8, STREAM_SCENE = 64, STREAM_KINDS = ['o', 'p', 'e', 's', 'c'];
const STREAM_GROUPS = [
  ['Where', ['x', 'y', 'z', 'yaw', 'pitch', 'roll']],
  ['How it moves', ['speed', 'vx', 'vy', 'vz', 'acc', 'spin']],
  ['Its state', ['size', 'shown', 'clip', 'path', 'motion']],
  ['People', ['near', 'count']],
];
const STREAM_V = STREAM_GROUPS.flatMap(g => g[1]), STREAM_STATE = ['size', 'shown', 'clip', 'path', 'motion', 'near', 'count'];
const STREAM_RANGE = { x: [-3, 3], z: [-3, 3], y: [0, 2.5], yaw: [-180, 180], roll: [-180, 180], pitch: [-90, 90], speed: [0, 3], vx: [-3, 3], vy: [-3, 3], vz: [-3, 3], acc: [0, 20], spin: [0, 720], size: [0.5, 2], shown: [0, 1], clip: [0, 1], path: [0, 1], motion: [0, 1], near: [0, 4], count: [0, 4] };
const STREAM_WORD = { x: 'X', y: 'Y', z: 'Z', yaw: 'Yaw', pitch: 'Pitch', roll: 'Roll', speed: 'Speed', vx: 'Speed along x', vy: 'Speed up', vz: 'Speed along z', acc: 'Acceleration', spin: 'Turning speed',
  size: 'Size', shown: 'Shown', clip: 'Its animation', path: 'Its recorded path', motion: 'Its motion', near: 'Nearest person', count: 'People inside' };
const STREAM_UNIT = { x: 'm', y: 'm', z: 'm', yaw: '°', pitch: '°', roll: '°', speed: 'm/s', vx: 'm/s', vy: 'm/s', vz: 'm/s', acc: 'm/s²', spin: '°/s', size: '×', near: 'm' };
const STREAM_SMOOTH = [0, 0.25, 0.5, 0.75, 0.9, 0.95];
Object.assign(STU, { stp: null, badStream: 0 });
// a watch of an item's values for Range from its movement: { id, v, until, lo, hi, n }, and a kinematic memory per item
const STW = { w: null, k: new Map(), log: [] };

// ---------------------------------------------------------------- the record --
// a list as a record keeps it (null: not a list); an entry that is not one is dropped (counted where a layout is read), an
// exact duplicate dropped, at most 8; a field that does not apply is not written, nor one at its default (hz 30, ch 1, at
// 0.5, val 100, smooth 0, a range end at the value's own)
function normStream(list, kind) {
  if (!Array.isArray(list)) return null;
  const out = [], seen = new Set();
  for (const e of list) {
    if (out.length >= STREAM_MAX) break;
    const r = normStreamOne(e, kind);
    if (!r) continue;
    const k = JSON.stringify(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}
function normStreamOne(e, kind) {
  if (!e || typeof e !== 'object' || Array.isArray(e) || !STREAM_V.includes(e.v) || (e.v === 'count' && kind !== 'c')) return null;
  const has = k => e[k] !== undefined && e[k] !== null, int = (x, a, b) => Number.isInteger(x) && x >= a && x <= b, D = STREAM_RANGE[e.v];
  if ((has('min') && !fin(e.min)) || (has('max') && !fin(e.max))) return null;
  const lo = has('min') ? r4(e.min) : D[0], hi = has('max') ? r4(e.max) : D[1];
  if (lo === hi || Math.abs(lo) > 1e6 || Math.abs(hi) > 1e6) return null;
  if (has('curve') && e.curve !== 'inv') return null;
  if (has('smooth') && !(fin(e.smooth) && e.smooth >= 0 && e.smooth <= 0.95)) return null;
  const hmax = e.v === 'near' || e.v === 'count' ? 15 : 60;
  if (has('hz') && !int(e.hz, 1, hmax)) return null;
  if (has('cc') && has('note')) return null;
  if (has('cc') && !int(e.cc, 0, 127)) return null;
  if (has('note') && !int(e.note, 0, 127)) return null;
  if (has('wide') && typeof e.wide !== 'boolean') return null;
  if (e.wide === true && !(has('cc') && e.cc <= 31)) return null;
  if (has('at') && !(fin(e.at) && e.at >= 0.01 && e.at <= 0.99)) return null;
  if (has('vel') && e.vel !== 'speed') return null;
  if (has('val') && !int(e.val, 1, 127)) return null;
  if (has('ch') && !int(e.ch, 1, 16)) return null;
  if (has('osc') && (typeof e.osc !== 'string' || !SEND_OSC.test(e.osc) || e.osc.includes('//'))) return null;
  const r = { v: e.v };
  if (lo !== D[0]) r.min = lo;
  if (hi !== D[1]) r.max = hi;
  if (e.curve === 'inv') r.curve = 'inv';
  if (has('smooth') && r2(e.smooth) > 0) r.smooth = r2(e.smooth);
  if (has('hz') && e.hz !== 30) r.hz = e.hz;
  if (has('cc')) { r.cc = e.cc; if (e.wide === true) r.wide = true; }
  if (has('note')) {
    r.note = e.note;
    if (has('at') && r2(e.at) !== 0.5) r.at = r2(e.at);
    if (e.vel === 'speed') r.vel = 'speed'; else if (has('val') && e.val !== 100) r.val = e.val;
  }
  if ((has('cc') || has('note')) && has('ch') && e.ch !== 1) r.ch = e.ch;
  if (has('osc')) r.osc = e.osc;
  return r;
}
// a list given for a record: kept only when it has an entry (else undefined); null a bad one (not a list)
const streamKeep = (x, kind) => { if (x == null) return undefined; const l = normStream(x, kind); return l === null ? null : l.length ? l : undefined; };
// the scene's entries but one item's (the scene's 64)
const streamCount = except => [...STU.items.values()].reduce((n, it) => n + (it.id !== except && it.rec && it.rec.stream ? it.rec.stream.length : 0), 0);
// a record whose entries would take the scene past 64: the rest dropped (n: the scene's so far, in the order read); how many
function streamCap(rec, n) {
  if (!rec || !rec.stream) return 0;
  const room = Math.max(0, STREAM_SCENE - n);
  if (rec.stream.length <= room) return 0;
  const cut = rec.stream.length - room;
  if (room) rec.stream = rec.stream.slice(0, room); else delete rec.stream;
  return cut;
}
// a copy's record (Duplicate, a group's copy): its streams trimmed to what the scene's 64 still takes, so every device
// keeps the same (apply trims past 64 in the order read: a copy past it would differ here); STREAMCUT counts what went
let STREAMCUT = 0;
const streamFit = rec => { if (rec) STREAMCUT += streamCap(rec, streamCount()); return rec; };
// the default OSC address of a stream (Wire 4)
const streamAddr = (it, v) => `/studio/${it.kind === 'c' ? 'cube' : 'item'}/${it.id}/${v}`;

// --------------------------------------------------------------- the values --
// an item's state value now (out.value): null for the kinematic ones (the page measures those from out.pose) and where there
// is none (no head near, an unknown id)
function outValue(id, v) {
  const it = STU.items.get(id);
  if (!it || !STREAM_KINDS.includes(it.kind) || !STREAM_STATE.includes(v)) return null;
  try {
    if (v === 'shown') return (it.kind === 'c' ? it.on !== false : !!it.shown && !it.notHere) ? 1 : 0;
    if (v === 'size') {
      const H = it.holder;
      if (!H || H.matrixAutoUpdate) return 1;
      const k = _svV.setFromMatrixColumn(H.matrix, 0).length(), k0 = H.scale.x;
      return k0 > 0 ? r4(k / k0) : 1;
    }
    if (v === 'clip') return it.action && it.dur > 0 ? r4(clamp(it.action.time / it.dur, 0, 1)) : 0;
    if (v === 'path') return pathOf(it) && fin(it.pph) ? r4(it.pph) : 0;
    if (v === 'motion') return it.rec.motion && fin(it.mph) ? r4(it.mph) : 0;
    const hs = behHeads(behNow());
    if (v === 'count') return it.kind === 'c' ? hs.filter(h => inCube(it.rec, h.p)).length : null;
    if (!hs.length) return null;
    const p = itemTopInto(it, _svP, true);
    let d = Infinity;
    for (const h of hs) d = Math.min(d, h.p.distanceTo(p));
    return fin(d) ? r4(d) : null;
  } catch (e) { return null; }
}
const _svV = new THREE.Vector3(), _svP = new THREE.Vector3(), _svE = new THREE.Euler(), _svQ = new THREE.Quaternion(), _svQ2 = new THREE.Quaternion();
// a value measured here from where an item is drawn (Range from its movement; the output page measures its own): its place,
// its turn as yaw, pitch and roll (degrees), and its speeds from the last frame's (K: this item's memory)
function streamMeasure(id, v, now) {
  if (STREAM_STATE.includes(v)) return outValue(id, v);
  const P = outPose(id);
  if (!P) return null;
  let K = STW.k.get(id);
  const t = now / 1000, p = P.p, q = _svQ.fromArray(P.q);
  if (!K || t - K.t > 1 || t <= K.t) { K = { t, p: p.slice(), q: P.q.slice(), v: [0, 0, 0], a: 0, w: 0, seen: K ? K.seen : 0 }; STW.k.set(id, K); }
  else {
    const dt = t - K.t, nv = [0, 1, 2].map(i => (p[i] - K.p[i]) / dt);
    K.a = Math.hypot(nv[0] - K.v[0], nv[1] - K.v[1], nv[2] - K.v[2]) / dt;
    K.w = (_svQ2.fromArray(K.q).angleTo(q) * 180 / Math.PI) / dt;
    K.v = nv; K.t = t; K.p = p.slice(); K.q = P.q.slice(); K.seen++;
  }
  if (v === 'x' || v === 'y' || v === 'z') return p['xyz'.indexOf(v)];
  if (v === 'yaw' || v === 'pitch' || v === 'roll') { _svE.setFromQuaternion(q, 'YXZ'); return (v === 'yaw' ? _svE.y : v === 'pitch' ? _svE.x : _svE.z) * 180 / Math.PI; }
  if (!K.seen) return null;   // (a speed needs two frames)
  if (v === 'speed') return Math.hypot(...K.v);
  if (v === 'vx' || v === 'vy' || v === 'vz') return K.v['xyz'.indexOf(v[1])];
  if (v === 'acc') return K.a;
  if (v === 'spin') return K.w;
  return null;
}
// each frame (itemsStep): a watch under way for Range from its movement takes this frame's value; done after 5 s, its range
// the least and most measured widened by 5 % each way (nothing measured: said so)
function streamStep() {
  const W = STW.w;
  if (!W) return;
  const now = performance.now(), it = STU.items.get(W.id);
  if (!it || !STU.stp || STU.stp.id !== W.id) { STW.w = null; return; }
  const x = streamMeasure(W.id, W.v, now);
  if (fin(x)) { W.lo = Math.min(W.lo, x); W.hi = Math.max(W.hi, x); W.n++; }
  if (now - W.last > 250) { W.last = now; dirty(); }
  if (now < W.until) return;
  STW.w = null;
  const P = STU.stp;
  if (!W.n || !(W.hi - W.lo > 1e-6)) { P.note = W.n ? 'It did not change in 5 s: the range is as it was.' : 'Nothing measured in 5 s: the range is as it was.'; dirty(true); return; }
  const pad = (W.hi - W.lo) * 0.05;
  P.min = r4(W.lo - pad); P.max = r4(W.hi + pad); P.note = `Range from its movement: ${fmtV(P.v, P.min)} to ${fmtV(P.v, P.max)}.`;
  STW.log.push([W.id, W.v, W.n, P.min, P.max]); if (STW.log.length > 20) STW.log.shift();
  dirty(true);
}
const fmtV = (v, x) => (Math.abs(x) >= 100 ? Math.round(x) : Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(2)) + (STREAM_UNIT[v] ? ' ' + STREAM_UNIT[v] : '');

// -------------------------------------------------------------------- the card --
function streamWords(it, e) {
  const D = STREAM_RANGE[e.v], lo = e.min !== undefined ? e.min : D[0], hi = e.max !== undefined ? e.max : D[1];
  const out = e.cc !== undefined ? `CC ${e.cc}${e.wide ? ' (14-bit)' : ''} ch ${e.ch || 1}` : e.note !== undefined ? `note ${e.note} at ${Math.round((e.at === undefined ? 0.5 : e.at) * 100)} % ch ${e.ch || 1}` : 'OSC only';
  return `${STREAM_WORD[e.v]} → ${out} · ${fmtV(e.v, lo)} to ${fmtV(e.v, hi)}` + (e.curve ? ' · inverted' : '') + (e.smooth ? ` · smoothed ${Math.round(e.smooth * 100)} %` : '');
}
const stP = it => (STU.stp && STU.stp.id === it.id ? STU.stp : null);
const stNew = (it, e, idx) => {
  const D = STREAM_RANGE[e ? e.v : 'y'];
  return { id: it.id, idx, v: e ? e.v : 'y', out: e && e.cc !== undefined ? 'cc' : e && e.note !== undefined ? 'note' : 'none', n: e ? (e.cc !== undefined ? e.cc : e.note !== undefined ? e.note : 20) : 20,
    ch: e && e.ch ? e.ch : 1, wide: !!(e && e.wide), at: e && e.at !== undefined ? e.at : 0.5, vel: e && e.vel === 'speed' ? 'speed' : 'val', val: e && e.val !== undefined ? e.val : 100,
    min: e && e.min !== undefined ? e.min : D[0], max: e && e.max !== undefined ? e.max : D[1], curve: !!(e && e.curve), smooth: e && e.smooth ? e.smooth : 0, hz: e && e.hz ? e.hz : 30,
    osc: (e && e.osc) || '', oscText: undefined, oscBad: false, note: '' };
};
function stDraft(P, kind) {
  const e = { v: P.v, min: P.min, max: P.max };
  if (P.curve) e.curve = 'inv';
  if (P.smooth) e.smooth = P.smooth;
  if (P.hz !== 30) e.hz = P.v === 'near' || P.v === 'count' ? Math.min(15, P.hz) : P.hz;
  if (P.out === 'cc') { e.cc = P.n; if (P.wide && P.n <= 31) e.wide = true; e.ch = P.ch; }
  if (P.out === 'note') { e.note = P.n; e.at = P.at; if (P.vel === 'speed') e.vel = 'speed'; else e.val = Math.max(1, P.val); e.ch = P.ch; }
  if (P.osc) e.osc = P.osc;
  return normStreamOne(e, kind);
}
function stSentence(it, P) {
  const d = stDraft(P, it.kind);
  if (!d) return 'Not one the scene can keep (the range\'s two ends must differ).';
  const osc = `OSC ${d.osc || streamAddr(it, d.v)} (0 to 1, and the value as measured)`;
  const what = `${STREAM_WORD[d.v].toLowerCase()} of ${it.rec.name}`;
  if (d.cc !== undefined) return `The output page sends the ${what} as MIDI controller ${d.cc}${d.wide ? ' and ' + (d.cc + 32) + ' (14-bit)' : ''} on channel ${d.ch || 1}, whenever it changes, and ${osc}.`;
  if (d.note !== undefined) return `As the ${what} rises past ${Math.round((d.at === undefined ? 0.5 : d.at) * 100)} % of its range, the output page plays note ${d.note} on channel ${d.ch || 1} (velocity ${d.vel === 'speed' ? 'from its speed' : d.val || 100}), and lets go as it falls back; ${osc} with a gate.`;
  return `The output page sends the ${what} as ${osc}.`;
}
// the Streams rows (an object's, a shape's, an empty's, a sound's and a cube's card while editing, page and headset; not
// refused by a lock in place): a row per entry (a press opens it to change; Try; ✕), and Add a stream...
function streamBlocks(it, B) {
  if (!STREAM_KINDS.includes(it.kind) || !editOn()) return;
  const L = it.rec.stream || [], P = stP(it), full = L.length >= STREAM_MAX || (!P && streamCount() >= STREAM_SCENE);
  const head = L.length ? `Streams (${L.length})` : 'Streams', at = B.length;
  if (!L.length && !P) B.push({ p: 'A stream sends a value of it (where it is, how fast it moves, its state, who is near) to the output page as MIDI and OSC, many times a second.', c: 'faint' });
  L.forEach((e, k) => B.push({ row: [
    { id: `ste:${k}`, label: streamWords(it, e), act: 'i:stEdit', v: k, on: !!(P && P.idx === k) },
    { id: `sttry:${k}`, label: 'Try', act: 'i:stTry', v: k },
    { id: `stx:${k}`, label: '✕', act: 'i:stDel', v: k, col: 'red' }] }));
  B.push({ row: [{ id: 'stadd', label: P ? 'Cancel' : 'Add a stream...', act: 'i:stPick', on: !!P, dis: !P && full }] });
  B[at].label = head;   // (the heading on the first of its rows: a page draws no heading alone)
  if (full) B.push({ p: L.length >= STREAM_MAX ? `${STREAM_MAX} streams: the most one item takes.` : `The scene has ${STREAM_SCENE} streams: the most it takes.`, c: 'amber' });
  if (P) stPickBlocks(it, B, P, L);
}
function stPickBlocks(it, B, P, L) {
  for (const [g, vs] of STREAM_GROUPS) {
    const opts = vs.filter(v => v !== 'count' || it.kind === 'c');
    B.push({ label: g, row: opts.map(v => ({ id: 'stv:' + v, label: STREAM_WORD[v], act: 'i:stV', v, on: P.v === v })) });
  }
  B.push({ label: 'Sends', row: [['none', 'OSC only'], ['cc', 'Controller'], ['note', 'Note']].map(([v, l]) => ({ id: 'stout:' + v, label: l, act: 'i:stOut', v, on: P.out === v })) });
  if (P.out !== 'none') {
    const nm = P.out === 'cc' ? 'Controller' : 'Note';
    B.push({ label: `${nm}: ${P.n}`, row: [-12, -1, 1, 12].map(d => ({ id: 'stn:' + d, label: (d > 0 ? '+' : '−') + Math.abs(d), act: 'i:stN', v: d })) },
      { label: `Channel: ${P.ch}`, row: [{ id: 'stch:-', label: '−1', act: 'i:stCh', v: -1, dis: P.ch <= 1 }, { id: 'stch:+', label: '+1', act: 'i:stCh', v: 1, dis: P.ch >= 16 }] });
    if (P.out === 'cc') B.push({ label: '14-bit (controller and controller + 32)', row: [{ id: 'stwide:off', label: 'Off', act: 'i:stWide', v: 'off', on: !P.wide }, { id: 'stwide:on', label: 'On', act: 'i:stWide', v: 'on', on: P.wide, dis: P.n > 31 }] });
    if (P.out === 'note') B.push({ label: `Plays as it rises past ${Math.round(P.at * 100)} %`, row: [-0.1, -0.05, 0.05, 0.1].map(d => ({ id: 'stat:' + d, label: (d > 0 ? '+' : '−') + Math.round(Math.abs(d) * 100) + ' %', act: 'i:stAt', v: d })) },
      { label: 'Velocity' + (P.vel === 'speed' ? ': from its speed' : `: ${P.val}`), row: [{ id: 'stvel:speed', label: 'From its speed', act: 'i:stVel', v: 'speed', on: P.vel === 'speed' }, { id: 'stvel:val', label: 'Fixed', act: 'i:stVel', v: 'val', on: P.vel !== 'speed' }]
        .concat(P.vel === 'speed' ? [] : [-10, 10].map(d => ({ id: 'stval:' + d, label: (d > 0 ? '+' : '−') + Math.abs(d), act: 'i:stVal', v: d }))) });
  }
  // the range: from its movement (5 s watched), or each end stepped by a tenth of the value's own range
  const W = STW.w && STW.w.id === it.id ? STW.w : null;
  B.push({ kv: [['Range', `${fmtV(P.v, P.min)} to ${fmtV(P.v, P.max)} → 0 to 1` + (P.curve ? ', inverted' : '')]] },
    { row: [{ id: 'strange', label: W ? `Watching: ${Math.max(0, Math.ceil((W.until - performance.now()) / 1000))} s` : 'Range from its movement', act: 'i:stWatch', on: !!W }, { id: 'strange:def', label: 'Its own range', act: 'i:stRangeDef' }] },
    { label: 'Low end', row: [-1, 1].map(d => ({ id: 'stmin:' + d, label: d > 0 ? '+' : '−', act: 'i:stMin', v: d })) },
    { label: 'High end', row: [-1, 1].map(d => ({ id: 'stmax:' + d, label: d > 0 ? '+' : '−', act: 'i:stMax', v: d })) },
    { label: 'Curve', row: [{ id: 'stcurve:lin', label: 'As it is', act: 'i:stCurve', v: 'lin', on: !P.curve }, { id: 'stcurve:inv', label: 'Inverted', act: 'i:stCurve', v: 'inv', on: P.curve }] },
    { label: 'Smoothing', row: STREAM_SMOOTH.map(s => ({ id: 'stsm:' + s, label: s ? Math.round(s * 100) + ' %' : 'Off', act: 'i:stSmooth', v: s, on: P.smooth === s })) });
  if (W) B.push({ p: 'Move it (or let it move) for 5 s: its least and most become the range.', c: 'amber' });
  if (P.note) B.push({ p: P.note, c: 'muted' });
  const own = P.osc || '';
  B.push({ kv: [['OSC', own ? `its own address ${own}` : `the default address ${streamAddr(it, P.v)}`]] },
    { page: true, label: 'OSC address of its own (empty: the default)', input: { id: 'stuStreamOsc', value: P.oscText === undefined ? own : P.oscText, ph: streamAddr(it, P.v), max: 128, aria: 'Its own OSC address' }, row: [{ id: 'stosc', label: 'Use it', act: 'i:stOsc', v: '' }] });
  if (P.oscBad) B.push({ page: true, p: 'Not an OSC address: it starts with / and has letters, digits and _ . - / only (no //).', c: 'amber' });
  B.push({ kv: [['It will', stSentence(it, P)]] });
  const d = stDraft(P, it.kind), rep = P.idx >= 0 && P.idx < L.length;
  B.push({ row: [{ id: 'stdo', label: rep ? 'Replace' : 'Add', act: 'i:stAdd', primary: true, dis: !d || (!rep && (L.length >= STREAM_MAX || streamCount() >= STREAM_SCENE)) }] });
}
// writes an item's list (an edit: the caller's change); an empty one takes it away
const streamWrite = (it, L) => setRec(it.id, { stream: L && L.length ? L : undefined });
const stepEnd = (P, d) => (STREAM_RANGE[P.v][1] - STREAM_RANGE[P.v][0]) / 10 * d;
Object.assign(ITEM_ACT, {
  stPick: it => { if (!STREAM_KINDS.includes(it.kind)) return; STU.stp = stP(it) ? null : stNew(it, null, -1); STW.w = null; },
  stEdit: (it, k) => { const e = (it.rec.stream || [])[+k]; if (!e) return; STU.stp = stP(it) && STU.stp.idx === +k ? null : stNew(it, e, +k); STW.w = null; },
  stV: (it, v) => {
    const P = stP(it);
    if (!P || !STREAM_V.includes(v) || (v === 'count' && it.kind !== 'c')) return;
    if (P.v !== v) { const D = STREAM_RANGE[v]; P.v = v; P.min = D[0]; P.max = D[1]; P.note = ''; STW.w = null; }
  },
  stOut: (it, v) => { const P = stP(it); if (P && ['none', 'cc', 'note'].includes(v)) { if (P.out !== v) P.n = v === 'note' ? 60 : 20; P.out = v; } },
  stN: (it, d) => { const P = stP(it); if (P) { P.n = clampI(P.n + (+d || 0), 0, 127); if (P.n > 31) P.wide = false; } },
  stCh: (it, d) => { const P = stP(it); if (P) P.ch = clampI(P.ch + (+d || 0), 1, 16); },
  stWide: (it, v) => { const P = stP(it); if (P) P.wide = v === 'on' && P.n <= 31; },
  stAt: (it, d) => { const P = stP(it); if (P) P.at = r2(clamp(P.at + (+d || 0), 0.05, 0.95)); },
  stVel: (it, v) => { const P = stP(it); if (P) P.vel = v === 'speed' ? 'speed' : 'val'; },
  stVal: (it, d) => { const P = stP(it); if (P) P.val = clampI(P.val + (+d || 0), 1, 127); },
  stMin: (it, d) => { const P = stP(it); if (P) { const x = r4(P.min + stepEnd(P, +d || 0)); if (x !== P.max) P.min = x; } },
  stMax: (it, d) => { const P = stP(it); if (P) { const x = r4(P.max + stepEnd(P, +d || 0)); if (x !== P.min) P.max = x; } },
  stRangeDef: it => { const P = stP(it); if (P) { [P.min, P.max] = STREAM_RANGE[P.v]; P.note = ''; } },
  stCurve: (it, v) => { const P = stP(it); if (P) P.curve = v === 'inv'; },
  stSmooth: (it, v) => { const P = stP(it); if (P && STREAM_SMOOTH.includes(+v)) P.smooth = +v; },
  stWatch: it => {
    const P = stP(it);
    if (!P) return;
    if (STW.w && STW.w.id === it.id) { STW.w = null; return; }
    STW.k.delete(it.id);
    STW.w = { id: it.id, v: P.v, until: performance.now() + 5000, lo: Infinity, hi: -Infinity, n: 0, last: 0 };
    P.note = '';
  },
  stOsc: it => { const P = stP(it); if (!P) return; const s = (P.oscText === undefined ? P.osc : P.oscText).trim(); if (!s) { P.osc = ''; P.oscBad = false; } else if (SEND_OSC.test(s) && !s.includes('//')) { P.osc = s; P.oscBad = false; } else P.oscBad = true; P.oscText = undefined; },
  // Try: one effect send with ev 'stream' and its value (the output page sweeps it 0 → 1 → 0 over 1 s)
  stTry: (it, k) => { const e = (it.rec.stream || [])[+k]; if (e) sendFx({ id: it.id, ev: 'stream', at: Math.round(behNow()), try: 1, v: e.v }); },
  stAdd: it => {
    const P = stP(it);
    if (!P) return;
    if (P.oscText !== undefined) ITEM_ACT.stOsc(it);
    if (P.oscBad) return;
    const d = stDraft(P, it.kind);
    if (!d) return;
    const L = (it.rec.stream || []).slice();
    if (P.idx >= 0 && P.idx < L.length) L[P.idx] = d;
    else if (L.length >= STREAM_MAX || streamCount() >= STREAM_SCENE) return;
    else L.push(d);
    streamWrite(it, normStream(L, it.kind));
    STU.stp = null; STW.w = null;
  },
  stDel: (it, k) => { const L = (it.rec.stream || []).slice(); if (!(+k >= 0 && +k < L.length)) return; L.splice(+k, 1); streamWrite(it, L); if (STU.stp && STU.stp.id === it.id) STU.stp = null; },
});
PANE_ONLY.push('stPick', 'stEdit', 'stV', 'stOut', 'stN', 'stCh', 'stWide', 'stAt', 'stVel', 'stVal', 'stMin', 'stMax', 'stRangeDef', 'stCurve', 'stSmooth', 'stWatch', 'stOsc', 'stTry');
// the page's address field, as typed (e7b_upload.js's input listener): kept until Use it or Add
function stInput(id, value) { if (id === 'stuStreamOsc' && STU.stp) STU.stp.oscText = String(value); }
function streamSig() {
  const P = STU.stp, W = STW.w;
  return P ? [P.id, P.idx, P.v, P.out, P.n, P.ch, P.wide, P.at, P.vel, P.val, P.min, P.max, P.curve, P.smooth, P.osc, P.oscBad, P.note, W ? Math.ceil((W.until - performance.now()) / 1000) : ''].join() : '';
}
// for tests: STUDIO.streamSet(id, list | null) (an edit, one Undo step), STUDIO.streams()
function streamSet(id, list) {
  const it = STU.items.get(id);
  if (!it || !STREAM_KINDS.includes(it.kind)) return null;
  const L = list === null || list === undefined ? [] : normStream(list, it.kind);
  if (L === null) return null;
  change(() => streamWrite(it, L));
  return (STU.items.get(id).rec.stream || []).map(e => Object.assign({}, e));
}
const streamState = () => ({ pick: STU.stp ? Object.assign({}, STU.stp) : null, watch: STW.w ? Object.assign({}, STW.w) : null, log: STW.log.slice(), count: streamCount(), bad: STU.badStream });
// a stream's Try heard (the effect send with ev 'stream', try: 1; sendHeard): the event { ev: 'stream', id, k, name, who, at,
// v, stream: its entries for v, send: [], try: 1 } to the output page, which sweeps them 0 → 1 → 0 over 1 s
function streamHeard(data, by) {
  if (data.try !== 1 || !STREAM_V.includes(data.v)) return;
  const it = STU.items.get(data.id), L = it && STREAM_KINDS.includes(it.kind) ? (it.rec.stream || []).filter(e => e.v === data.v) : [];
  if (!L.length) return;
  outEmit(it, 'stream', typeof by === 'string' ? by.slice(0, 32) : '', data.at, undefined, true, { v: data.v, stream: L.map(e => Object.assign({}, e)) });
}

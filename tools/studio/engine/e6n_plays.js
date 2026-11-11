// =================================================== CUBES THAT START THINGS ==
// A trigger cube may start things on a character or a prop as you walk in or out (v136; the owner, 11 November 2026:
// "Trigger cube should also be able to trigger things like an animation or a soundfile being played on a character or
// prop"; tools/studio/SPEC.md, "Trigger cubes that start things"). Its record's plays: up to 16 entries
// { on, what, clip?, how, when? }:
// - on: the item it starts something on (an object's, a sound's, a shape's or an empty's id);
// - what: 'clip' (one of an object's animations, named in clip), 'sound' (a sound), 'path' (an object's, a shape's, an
//   empty's or a sound's recorded path) or 'motion' (an object's, a shape's or an empty's motion);
// - how: 'once' (from its start to its end, even after you leave), 'loop' (again and again while the cube is active for
//   you: a while cube until you have left, a stay cube from then on; then it comes off), 'hold' (clips and paths: once to
//   its end, held there while the cube is active, then it comes off) or 'stop' (ends what runs on that item now, whatever
//   started it);
// - when: 'leave' (once and stop only: as you leave the cube), else as you walk in.
// Each person's own, as everything a cube does: nothing is sent and nothing is stored but the cube's record. An entry
// fires as its cube is entered (each time: a stay cube walked into again too, and the head inside as the scene opens, the
// cube appears or the entry is added), or left; both debounced 0.3 s (PLAY_EDGE: out for 0.3 s counts as having left, and
// in again within that is no new entry), so a head on a cube's face never restarts a wave. Show and hide are not
// debounced (no scene changes).
// On each item and what is started on it, the last start decides: it replaces the run under way, and when a run ends
// nothing older comes back (an object's own animation is back; a sound, a path or a motion waits). How each comes off:
// a clip blends over the object's own animation, or its rest pose, in and out over 0.3 s (PLAY_BLEND; a new run on it
// crossfades from the old one's frame); a sound fades out over 0.4 s (a new run starts it again at its level at once); a
// path that loops finishes the pass under way and waits there, one held goes back along its path to its start, one
// stopped while once stays where it is; a motion finishes the period under way (a wobble's or an orbit's amount eased in
// and out). What a cube names waits until a cube starts it: a sound silent, a path at its start (or where its last run
// left it), a motion at rest; its own Starts (and a sound's own Loop) no longer apply. An object's own animation goes on
// until a cube plays a clip over it. A sound that plays with a recorded path (sync) is no target: starting that path
// starts its voice. Pause, a timeline's hold, a carry and a character worn with trackers win over a run, as over
// everything that moves
const PLAY_WHAT = ['clip', 'sound', 'path', 'motion'], PLAY_HOW = ['once', 'loop', 'hold', 'stop'], PLAY_MAX = 16, PLAY_BLEND = 300, PLAY_FADE = 400, PLAY_EDGE = 300, PLAY_TRY = 10000;
// (what each can be started on, by item kind, and its bit in an item's tgM: what a cube names on it)
const PLAY_KINDS = { clip: ['o'], sound: ['s'], path: ['o', 'p', 'e', 's'], motion: ['o', 'p', 'e'] }, PLAY_BIT = { clip: 1, sound: 2, path: 4, motion: 8 };
const PLAY_ITEMS = ['o', 's', 'p', 'e'];
// list: every entry { c (its cube), e, ek }; cubes: the cubes with plays; seen: the entries already known (one new while
// its cube is active fires at once); on: the items with a run; log: the last 100 starts and ends (tests); n: runs started
// (a voice's pass); rev2: moves on at each start and end; said: a missing clip logged once a scene opening
const TRG = { gen: -1, rev: -1, list: [], cubes: [], seen: new Map(), on: new Set(), log: [], n: 0, rev2: 0, said: new Set() };
// its clock (ms; the tests set their own, as recClock)
let trgClock = () => performance.now();
const playEk = (c, e) => c.id + '|' + e.on + '|' + e.what + '|' + (e.when || 'enter') + '|' + e.how + '|' + (e.clip || '');
const playKey = e => e.on + '|' + e.what + '|' + (e.when || 'enter');
const plog = (ev, d) => { try { if (HOST.collab && HOST.collab.log) HOST.collab.log(ev, d); } catch (e) { /* no log */ } };
const trgPush = x => { TRG.log.push(x); if (TRG.log.length > 100) TRG.log.shift(); };
// a cube's entries as a record keeps them: one that is not one is dropped, as is a second for the same item, what and
// moment; a clip's name required (but for a stop), cut to 120 characters; at most 16. Fields in this order: on, what,
// clip, how, when (how always written, when only for 'leave')
function normPlays(list) {
  const out = [], seen = new Set();
  for (const e of list) {
    if (out.length >= PLAY_MAX) break;
    if (!e || typeof e !== 'object' || Array.isArray(e) || !okId(e.on) || !PLAY_WHAT.includes(e.what)) continue;
    const how = e.how === undefined ? 'once' : e.how, when = e.when === undefined || e.when === null || e.when === 'enter' ? '' : e.when;
    if (!PLAY_HOW.includes(how) || (when && when !== 'leave')) continue;
    if (how === 'hold' && e.what !== 'clip' && e.what !== 'path') continue;
    if (when === 'leave' && how !== 'once' && how !== 'stop') continue;
    const clip = e.what === 'clip' && how !== 'stop' ? (typeof e.clip === 'string' && e.clip.trim() ? e.clip.slice(0, 120) : null) : '';
    if (clip === null) continue;
    const r = { on: e.on, what: e.what };
    if (clip) r.clip = clip;
    r.how = how;
    if (when) r.when = when;
    const k = playKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

// ------------------------------------------------------------ each frame --
// the entries, made again only when the items change (STU.rev) or the scene opens again (STU.gen: nothing runs then)
function trgList() {
  if (TRG.rev === STU.rev && TRG.gen === STU.gen) return;
  if (TRG.gen !== STU.gen) { TRG.seen.clear(); TRG.on.clear(); TRG.said.clear(); for (const it of STU.items.values()) it.tr = null; }
  TRG.gen = STU.gen; TRG.rev = STU.rev;
  TRG.list = []; TRG.cubes = [];
  for (const it of STU.items.values()) it.tgM = 0;
  const keys = new Set();
  for (const c of STU.items.values()) {
    if (c.kind !== 'c' || !c.rec.plays) continue;
    TRG.cubes.push(c);
    for (const e of c.rec.plays) {
      const ek = playEk(c, e);
      keys.add(ek);
      TRG.list.push({ c, e, ek });
      const t = STU.items.get(e.on);
      if (t && PLAY_KINDS[e.what].includes(t.kind)) t.tgM |= PLAY_BIT[e.what];
    }
  }
  for (const k of [...TRG.seen.keys()]) if (!keys.has(k)) TRG.seen.delete(k);
  for (const it of STU.items.values()) {
    // (a cube with no starts left keeps no edge: entries put back by Undo start from where the head is then, never a stale
    // inside; trgFire works out only the cubes that have starts)
    if (it.kind === 'c' && !(it.rec.plays && it.rec.plays.length)) it.pl = null;
    // (a sound, path or motion no cube names any more: its run ends here, the item back on its own record; trgSound,
    // trgPathAt and trgMotion are never asked for it again. A clip's layers blend out by themselves: animStep goes on
    // stepping them while it has any)
    if (!it.tr) continue;
    for (const k of ['sound', 'path', 'motion']) {
      const R = it.tr && it.tr[k];
      if (R && !(it.tgM & PLAY_BIT[k])) { if (k === 'sound') emitStop(it); trgDone(it, k, R, 'gone'); }
    }
  }
}
// once the cubes are worked out for this frame (the end of triggerStep): each cube's entering and leaving, debounced
// (c.pl: in, out (when the head went out; -1 in), lt (the moment it counts as having left: out + 0.3 s), act (active for
// you, debounced)); the entries that fire (leaving first, then entering); and the loops and holds whose cube is no longer
// active for you (or gone, or the entry gone) come off
function trgFire() {
  trgList();
  if (!TRG.list.length && !TRG.on.size) return;
  const T = trgClock();
  let left = false;
  for (const c of TRG.cubes) {
    const P = c.pl || (c.pl = { in: false, out: -1, lt: 0, act: false, enter: false, leave: false });
    P.enter = P.leave = false;
    if (c.inside) {
      // (out long enough with no frame between, and in again: it left, then came in)
      if (P.in && P.out >= 0 && T - P.out >= PLAY_EDGE) { P.in = false; P.leave = true; P.lt = P.out + PLAY_EDGE; }
      P.out = -1;
      if (!P.in) P.in = P.enter = true;
    } else if (P.in) {
      if (P.out < 0) P.out = T;
      else if (T - P.out >= PLAY_EDGE) { P.in = false; P.leave = true; P.lt = P.out + PLAY_EDGE; }
    }
    if (P.leave) left = true;
    P.act = c.rec.mode === 'stay' ? !!c.act : P.in;
  }
  if (left) for (const x of TRG.list) if (x.e.when === 'leave' && x.c.pl.leave) { TRG.seen.set(x.ek, 1); trgStart(x, Math.min(T, x.c.pl.lt || T), false); }
  for (const x of TRG.list) {
    if (x.e.when === 'leave') { if (!TRG.seen.has(x.ek)) TRG.seen.set(x.ek, 1); continue; }
    const P = x.c.pl, fresh = !TRG.seen.has(x.ek);
    if (fresh) TRG.seen.set(x.ek, 1);
    if (P.enter || (fresh && P.act)) trgStart(x, T, false);
  }
  for (const t of TRG.on) {
    if (STU.items.get(t.id) !== t) { TRG.on.delete(t); continue; }
    for (const k of PLAY_WHAT) {
      const R = t.tr && t.tr[k];
      if (!R || R.off || (R.e.how !== 'loop' && R.e.how !== 'hold') || R.try > T) continue;
      const C = R.c, here = STU.items.get(C.id) === C && C.pl && C.pl.act && TRG.seen.has(R.ek);
      if (!here) trgOff(R, C.pl && C.pl.leave && C.pl.lt ? Math.min(T, C.pl.lt) : T, 'left');
    }
  }
}
// an entry fires: its run on its item from now (tried: by its card's Try, a loop or a hold coming off after 10 s unless
// its cube is active for you); a stop ends the run on that item and starts nothing
function trgStart(x, T, tried) {
  const { c, e, ek } = x, t = STU.items.get(e.on);
  if (!t || !PLAY_KINDS[e.what].includes(t.kind)) return false;
  if (e.what === 'sound' && syncOf(t)) return false;   // (a voice that plays with a path: started with its path)
  trgPush(['start', c.id, e.on, e.what, e.clip || '', e.how, e.when || 'enter', T]);
  plog('studio play', { cube: c.id, on: e.on, what: e.what, clip: e.clip || '', how: e.how, when: e.when || 'enter' });
  const was = t.tr && t.tr[e.what];
  if (e.how === 'stop') { if (was && !was.off) trgOff(was, T, 'stop'); return true; }
  if (!t.tr) t.tr = {};
  t.tr[e.what] = { c, e, ek, at: T, off: 0, n: ++TRG.n, try: tried ? T + PLAY_TRY : 0, seen: false, layer: null };
  TRG.on.add(t); TRG.rev2++;
  return true;
}
// a run comes off (left, stopped, tried long enough): each kind as it does (its clip blends out, its sound fades, its path
// finishes its pass or goes back, its motion its period)
function trgOff(R, T, why) {
  if (R.off) return;
  R.off = T;
  trgPush(['off', R.e.on, R.e.what, why, T]);
  TRG.rev2++;
}
// a run over: its item waits again (or plays its own animation)
function trgDone(it, what, R, why) {
  if (!it.tr || it.tr[what] !== R) return;
  it.tr[what] = null;
  trgPush(['end', it.id, what, why]);
  TRG.rev2++;
  if (!PLAY_WHAT.some(k => it.tr[k])) { it.tr = null; if (!it.tl || !it.tl.length) TRG.on.delete(it); }
}
// everything forgotten (Reset what I have seen, the lobby): every run stopped at once, a cube you stand in fires again on
// the next frame
function trgReset(why) {
  for (const t of TRG.on) {
    if (t.tl) { for (const y of t.tl) try { y.a.stop(); } catch (e) { /* its mixer gone */ } t.tl = null; }
    if (t.kind === 's' && t.tr && t.tr.sound) emitStop(t);
  }
  for (const it of STU.items.values()) { it.tr = null; it.pw = 0; it.pl = null; if (it.tl) { for (const y of it.tl) try { y.a.stop(); } catch (e) { /* gone */ } it.tl = null; } }
  TRG.on.clear();
  trgPush(['reset', why || '']);
  TRG.rev2++;
}

// ----------------------------------------------------------------- clips --
// its layers (it.tl, at most 2: { a, R, dur, t, w, t0, w0, fadeAt }), each frame from animStep: a new run's layer blends
// in over 0.3 s, the one before it frozen at its frame and fading out meanwhile; a once fades out from its end, a loop or a
// hold from when it came off; held (a timeline's hold shows its own clip alone): every layer at weight 0. Returns the
// layers' weight (0 to 1: the object's own animation gets the rest)
function trgAction(it, clip, L) {
  const M = it.tAct || (it.tAct = new Map());
  let pair = M.get(clip.name);
  if (!pair) { pair = [it.mixer.clipAction(clip.clone()), it.mixer.clipAction(clip.clone())]; M.set(clip.name, pair); }
  return L && L.some(y => y.a === pair[0]) ? pair[1] : pair[0];
}
// a layer's moment and weight at T (the current one, not fading)
function trgLayerAt(y, T) {
  const R = y.R, e = Math.max(0, (T - R.at) / 1000);
  y.t = R.e.how === 'loop' ? e % y.dur : Math.min(e, y.dur - 1e-4);
  const inW = Math.min(1, (T - R.at) / PLAY_BLEND), endAt = R.off || (R.e.how === 'once' ? R.at + y.dur * 1000 : 0);
  y.w = inW * (endAt && T > endAt ? Math.max(0, 1 - (T - endAt) / PLAY_BLEND) : 1);
  return endAt;
}
function trgClipStep(it, held) {
  const R = it.tr && it.tr.clip, T = trgClock();
  let L = it.tl;
  if (R && R.layer && !(L && L.includes(R.layer))) R.layer = null;   // (its layers dropped, a model built again: on by its clock)
  if (R && !R.layer) {
    // (the run before, if any: frozen where it is now, fading out; the last start decides, also one with nothing to play)
    if (L) for (const y of L) if (!y.fadeAt && y.R !== R) { trgLayerAt(y, T); y.t0 = y.t; y.w0 = y.w; y.fadeAt = T; }
    const clip = it.E && it.E.clips ? it.E.clips.find(k => k.name === R.e.clip) : null;
    if (!clip || !(clip.duration > 0)) {
      if (!TRG.said.has(R.ek)) { TRG.said.add(R.ek); plog('studio play missing', { cube: R.c.id, on: it.id, clip: R.e.clip }); }
      trgDone(it, 'clip', R, 'missing');
    } else {
      while (L && L.length >= 2) { const o = L.shift(); try { o.a.stop(); } catch (e) { /* gone */ } }
      const a = trgAction(it, clip, L);
      a.reset(); a.setEffectiveWeight(0); a.play();
      const y = { a, R, dur: clip.duration, t: 0, w: 0, t0: 0, w0: 0, fadeAt: 0 };
      L = it.tl = (L || []).concat(y);
      R.layer = y;
      TRG.on.add(it);
    }
  }
  if (!L || !L.length) return 0;
  for (let i = L.length - 1; i >= 0; i--) {
    const y = L[i];
    let gone = false;
    if (y.fadeAt) { y.t = y.t0; y.w = y.w0 * Math.max(0, 1 - (T - y.fadeAt) / PLAY_BLEND); gone = T - y.fadeAt >= PLAY_BLEND; }
    else {
      const endAt = trgLayerAt(y, T);
      gone = !!endAt && T - endAt >= PLAY_BLEND;
      if (gone) trgDone(it, 'clip', y.R, 'end');
    }
    if (gone) { try { y.a.stop(); } catch (e) { /* gone */ } L.splice(i, 1); if (y.R.layer === y) y.R.layer = null; }
  }
  if (!L.length) { it.tl = null; if (!it.tr) TRG.on.delete(it); return 0; }
  let sum = 0;
  for (const y of L) sum += y.w;
  const k = sum > 1 ? 1 / sum : 1;
  for (const y of L) {
    if (!y.a.isRunning()) y.a.play();
    y.a.setEffectiveWeight(held ? 0 : y.w * k);
    y.a.time = y.t;
  }
  return held ? 0 : Math.min(1, sum);
}

// ---------------------------------------------------------------- sounds --
// a sound a cube names (not one that plays with a path): silent until a run starts it, from its start at its level at
// once; a run that came off fades out over 0.4 s; a once over at its end
const trgOn = it => !!(it.tgM & 2) && !syncOf(it);
// whether it loops now: a run's how, else its record's Loop
const sLoop = it => (trgOn(it) ? !!(it.tr && it.tr.sound && it.tr.sound.e.how === 'loop') : !!it.rec.loop);
// its gain factor now (emitStep, every sound), or null when no cube names it
function trgSound(it) {
  if (!trgOn(it)) return null;
  const R = it.tr && it.tr.sound;
  if (!R) { it.tg = 0; return 0; }
  const T = trgClock();
  if (!R.seen) { R.seen = true; emitStop(it); it.ended = false; }
  let g = 1;
  if (R.off) g = Math.max(0, 1 - (T - R.off) / PLAY_FADE);
  else if (R.e.how !== 'loop' && it.F && it.F.dur > 0 && T - R.at >= it.F.dur * 1000) g = 0;
  it.tg = g;
  if (g <= 0) trgDone(it, 'sound', R, R.off ? 'off' : 'end');
  return g;
}
// where its run is now (s into its file), -1 over: emitOffset's for a sound a cube names
function trgSoundAt(it, dur) {
  const R = it.tr && it.tr.sound;
  if (!R) return -1;
  const e = Math.max(0, (trgClock() - R.at) / 1000);
  return R.e.how === 'loop' ? e % dur : e < dur - 0.05 ? e : -1;
}

// ----------------------------------------------------------------- paths --
// a path a cube names: its moment (s of the path) for POSE.path. No run: where its last run left it (it.pw; its start at
// first). Once: from its start to its end (there and back for Back and forth), then waits there; stopped, where it is.
// Loop: again and again; come off, it finishes the pass under way and waits at its end. Hold: to its end and held there;
// come off, back along its path at its speed to its start
function trgPathAt(it, P) {
  const R = it.tr && it.tr.path;
  if (!R) return it.pw || 0;
  const T = trgClock(), D = pathLen(P), sp = P.speed, bounce = P.play === 'bounce', cyc = bounce ? 2 * D : D;
  if (!(D > 0)) return 0;
  const u = Math.max(0, (T - R.at) / 1000 * sp), uo = R.off ? Math.max(0, (R.off - R.at) / 1000 * sp) : Infinity;
  const bnc = v => { const w = v % (2 * D); return w <= D ? w : 2 * D - w; }, endOf = bounce ? 0 : D;
  let m, done = false;
  if (R.e.how === 'hold') {
    if (R.off) { m = Math.max(0, Math.min(uo, D) - (T - R.off) / 1000 * sp); done = m <= 0; } else m = Math.min(u, D);
  } else if (R.e.how === 'loop') {
    const end = R.off ? Math.max(cyc, Math.ceil(uo / cyc - 1e-9) * cyc) : Infinity;
    if (u >= end) { m = endOf; done = true; } else m = bounce ? bnc(u) : u % D;
  } else if (R.off) { m = it.pw || 0; done = true; }
  else if (u >= cyc) { m = endOf; done = true; }
  else m = bounce ? bnc(u) : u;
  it.pw = m;
  if (done) trgDone(it, 'path', R, R.off ? 'off' : 'end');
  return m;
}
// a voice recorded with a path a cube names (syncAt): the run's time (s, at now) and number, or null while it waits (no
// run) or a hold goes back; undefined: no cube names the path (its own clock)
function trgPathTime(ob, now) {
  if (!(ob.tgM & 4)) return undefined;
  const R = ob.tr && ob.tr.path;
  if (!R || (R.e.how === 'hold' && R.off)) return null;
  return { T: (trgClock() + now - performance.now() - R.at) / 1000, n: R.n, loop: R.e.how === 'loop' };
}

// --------------------------------------------------------------- motions --
// a motion a cube names (drawnPose): undefined no cube names it (its own clock); null it rests (no run, or over); else
// { mo, t }: its moment. Once: one period (60 / |speed| s); a loop that came off (or was stopped) finishes the period under
// way; a wobble's and an orbit's amount eased in and out (they stand away from their place at the period's start)
const _tm2 = {}, _tmo = { mo: null, t: 0 };
function trgMotion(it, mo) {
  if (!(it.tgM & 8)) return undefined;
  const R = it.tr && it.tr.motion;
  if (!R) return null;
  const T = trgClock(), per = 60 / Math.max(0.1, Math.abs(mo.speed)), t = Math.max(0, (T - R.at) / 1000);
  const end = R.e.how === 'once' ? per : R.off ? Math.max(per, Math.ceil(Math.max(0, R.off - R.at) / 1000 / per - 1e-9) * per) : Infinity;
  if (t >= end) { trgDone(it, 'motion', R, R.off ? 'off' : 'end'); return null; }
  let m = mo;
  if (mo.kind === 'wobble' || mo.kind === 'orbit') {
    const ez = Math.min(0.5, per / 4), k = Math.min(1, t / ez, (end - t) / ez);
    if (k < 1) { m = Object.assign(_tm2, mo); _tm2.amount = mo.amount * Math.max(0, k); }
  }
  _tmo.mo = m; _tmo.t = t;
  return _tmo;
}

// ------------------------------------------------------------ words --
const HOW_WORD = { once: 'Once', loop: 'Loop', hold: 'Hold', stop: 'Stop' };
const whatWord = e => (e.what === 'clip' ? e.clip || 'its animation' : e.what === 'sound' ? 'the sound' : e.what === 'path' ? 'its recorded path' : 'its motion');
// an entry in words: "Dancer · Wave · once", "Voice · the sound · loops while you are inside", "Radio · stops · on leaving"
function playWords(e, c) {
  const t = STU.items.get(e.on), stay = c && c.rec.mode === 'stay', nm = t ? t.rec.name : 'an item not in the scene';
  const how = e.how === 'once' ? 'once' : e.how === 'loop' ? (stay ? 'loops from then on' : 'loops while you are inside') : e.how === 'hold' ? (stay ? 'held from then on' : 'held while inside') : '';
  const body = e.how === 'stop' ? (e.what === 'sound' ? 'stops' : 'stops ' + (e.what === 'clip' ? 'its animation' : whatWord(e))) : whatWord(e) + ' · ' + how;
  return `${nm} · ${body}` + (e.when === 'leave' ? ' · on leaving' : '');
}
// what can be started on an item: [{ what, clip, label, dis, why }] (a voice that plays with a path: none it can take)
function playOpts(t) {
  if (!t || !PLAY_ITEMS.includes(t.kind)) return [];
  const out = [];
  if (t.kind === 'o') for (const k of (t.E && t.E.clips) || []) if (k.duration > 0) out.push({ what: 'clip', clip: k.name, label: k.name, sub: secs(k.duration) });
  if (t.kind === 's') {
    const sy = syncOf(t);
    out.push(sy ? { what: 'sound', label: 'The sound', dis: true, why: `It plays with ${sy.rec.name}'s recorded path: start the path instead.` } : { what: 'sound', label: 'The sound' });
  }
  if (pathOf(t)) out.push({ what: 'path', label: 'Its recorded path' });
  if (t.kind !== 's' && t.rec.motion && MOTION[t.rec.motion.kind]) out.push({ what: 'motion', label: 'Its motion: ' + MOTION[t.rec.motion.kind].word });
  return out;
}
// an item's options in a line: "animations: Spin, Bob · recorded path"
function optsLine(t, o) {
  const cl = o.filter(x => x.what === 'clip').map(x => x.clip), rest = o.filter(x => x.what !== 'clip').map(x => x.what === 'sound' ? 'sound' : x.what === 'path' ? 'recorded path' : 'motion');
  return [cl.length ? (cl.length > 1 ? 'animations: ' : 'animation: ') + cl.slice(0, 6).join(', ') + (cl.length > 6 ? '...' : '') : ''].concat(rest).filter(Boolean).join(' · ');
}
// why an entry cannot play now ('' it can)
function playWhy(e) {
  const t = STU.items.get(e.on);
  if (!t || !PLAY_KINDS[e.what].includes(t.kind)) return 'It names an item not in the scene.';
  if (e.what === 'clip' && e.how !== 'stop' && t.model && !((t.E && t.E.clips) || []).some(k => k.name === e.clip)) return `${t.rec.name} has no animation ${e.clip} now.`;
  if (e.what === 'sound' && syncOf(t)) return `${t.rec.name} plays with ${syncOf(t).rec.name}'s recorded path: start the path instead.`;
  if (e.what === 'path' && !pathOf(t)) return t.kind === 's' && t.rec.on && t.rec.path ? `${t.rec.name} follows something: its own recorded path waits until it follows nothing.` : `${t.rec.name} has no recorded path.`;
  if (e.what === 'motion' && !t.rec.motion) return `${t.rec.name} has no motion.`;
  return '';
}
// what a draft entry will do, in a sentence: "As you walk in, Dancer plays Wave once from its start, then its own
// animation again."
function playSentence(d, c) {
  const t = STU.items.get(d.on);
  if (!t || !d.what) return 'Pick what to start.';
  const nm = t.rec.name, stay = c.rec.mode === 'stay', dur = stay ? 'from then on' : 'while you are inside', when = d.when === 'leave' ? 'As you walk out' : 'As you walk in';
  const own = t.kind === 'o' && t.rec.anim !== 'off' && t.rec.clip ? 'then its own animation again' : 'then it stands still again';
  // (a loop or a hold on a cube that stays never comes off: until Reset what I have seen, or the lobby)
  const after = x => (stay ? '' : ', ' + x), M = t.rec.motion && MOTION[t.rec.motion.kind];
  let s = '';
  if (d.what === 'clip') s = d.how === 'stop' ? `the animation a cube plays on ${nm} blends out, ${own}` : d.how === 'once' ? `${nm} plays ${d.clip} once from its start, ${own}` : d.how === 'loop' ? `${nm} plays ${d.clip} again and again ${dur}` + after(own) : `${nm} plays ${d.clip} once and holds its last frame ${dur}` + after(own);
  else if (d.what === 'sound') s = d.how === 'stop' ? `${nm} fades out` : d.how === 'once' ? `${nm} plays once from its start` : `${nm} plays again and again ${dur}` + after('then fades out');
  else if (d.what === 'path') s = d.how === 'stop' ? `${nm} stops on its recorded path where it is` : d.how === 'once' ? `${nm} plays its recorded path once from its start, and waits at its end` : d.how === 'loop' ? `${nm} plays its recorded path again and again ${dur}` + after('then finishes the pass under way') : `${nm} plays its recorded path to its end and holds there ${dur}` + after('then goes back to its start');
  else s = !M ? `${nm} has no motion` : d.how === 'stop' ? `${nm} finishes the ${M.one} under way and rests` : d.how === 'once' ? `${nm} ${M.does} once (one ${M.one}), then rests` : `${nm} ${M.does} ${dur}` + after(`then finishes the ${M.one} under way and rests`);
  return `${when}, ${s}.`;
}
// whether an entry's run is the one on its item now (for you)
function playing(c, e) {
  const t = STU.items.get(e.on), R = t && t.tr && t.tr[e.what];
  return !!R && !R.off && R.ek === playEk(c, e);
}
const holdOk = what => what === 'clip' || what === 'path';
// the cubes that name an item for a what, in words (a target's card): '' none
function playNote(it, what, B) {
  if (!(it.tgM & PLAY_BIT[what])) return;
  const cs = TRG.list.filter(x => x.e.on === it.id && x.e.what === what && x.e.how !== 'stop');
  const names = [...new Set(cs.map(x => x.c.rec.name))].join(', ') || [...new Set(TRG.list.filter(x => x.e.on === it.id && x.e.what === what).map(x => x.c.rec.name))].join(', ');
  const R = it.tr && it.tr[what], now = R && !R.off ? ' Playing for you now.' : '';
  if (what === 'clip') {
    const cl = [...new Set(cs.map(x => `${x.e.clip} (${x.e.how})`))].join(', ');
    B.push({ p: `${names} play${cs.length > 1 ? '' : 's'} ${cl || 'nothing'} on it: its own animation goes on otherwise; Off keeps it still until then.` + now, c: 'faint' });
  } else if (what === 'sound') B.push({ p: `A cube starts it (${names}): silent until then; its Plays and Starts do not apply.` + now, c: 'faint' });
  else if (what === 'path') B.push({ p: `A cube starts its path (${names}): it waits at its start (or where its last run left it); its Plays says what one pass is, Starts does not apply.` + now, c: 'faint' });
  else B.push({ p: `A cube starts its motion (${names}): it rests until then; Starts does not apply.` + now, c: 'faint' });
}
// the card's signature part: the selected cube's entries' playing flags, or the selected item's tgM ('' otherwise)
function playSig() {
  const it = STU.items.get(STU.sel);
  if (!it) return '';
  if (it.kind === 'c') return it.rec.plays ? it.rec.plays.map(e => +playing(it, e)).join('') : '';
  if (!it.tgM) return '';
  return it.tgM + ':' + PLAY_WHAT.map(k => +!!(it.tr && it.tr[k] && !it.tr[k].off)).join('');
}

// ------------------------------------------------------------ copies --
// an item's copy (Duplicate): beside each entry on the original, in every cube, one for the copy (a cube's 16 kept)
function playCopy(from, to) {
  for (const c of [...STU.items.values()]) {
    if (c.kind !== 'c' || !c.rec.plays || !c.rec.plays.some(e => e.on === from)) continue;
    setRec(c.id, { plays: withCopies(c.rec.plays, e => (e.on === from ? to : ''), PLAY_MAX) });
  }
}

// ------------------------------------------------------------ the cube's card --
// Starts: each entry (a press flashes its item in blue; Try plays it here now; ✕ takes it off, one Undo step), and Start
// something...: an item (pointed at, or from the card's list), what to start on it, how and when; Add (one Undo step)
const PLAY_PARA = 'What a cube starts is for you only, as everything a cube does. The last thing started on an item decides. A sound, a path or a motion a cube starts waits until then; an object\'s own animation goes on until a cube plays a clip on it (Animation Off keeps it still).';
function playCubeBlocks(c, B, dis) {
  const L = c.rec.plays || [], P = STU.plp && STU.plp.id === c.id ? STU.plp : null, full = L.length >= PLAY_MAX;
  const cands = [...STU.items.values()].filter(t => t.id !== c.id && PLAY_ITEMS.includes(t.kind)), any = cands.some(t => playOpts(t).some(o => !o.dis));
  if (!L.length) B.push({ kv: [['Starts', 'nothing']] });
  L.forEach((e, k) => {
    const on = playing(c, e), why = playWhy(e);
    B.push({ label: k ? '' : `Starts (${L.length})`, row: [
      { id: `plflash:${k}`, label: playWords(e, c) + (on ? ' · playing for you' : ''), act: 'i:plFlash', v: e.on, on },
      { id: `pltry:${k}`, label: on && e.how !== 'stop' ? 'Stop' : 'Try', act: 'i:plTry', v: k, dis: dis || !!why },
      { id: `unplay:${k}`, label: '✕', act: 'i:unplay', v: k, dis }] });
    if (why) B.push({ p: why, c: 'amber' });
  });
  B.push({ row: [{ id: 'plpick', label: P ? 'Cancel' : 'Start something...', act: 'i:plPick', on: !!P, dis: dis || (!P && (full || !any)) }] });
  if (full) B.push({ p: `${PLAY_MAX} starts: the most a cube takes.`, c: 'amber' });
  else if (!any && !L.length) B.push({ p: 'A cube can start an animation, a sound, a recorded path or a motion as you walk in or out: place something that has one first.', c: 'faint' });
  if (P && P.step === 'obj') {
    B.push({ p: (XR.on ? 'Point at it and pull the trigger' : 'Click it in the scene, or pick it here') + ': an object, a sound, a shape or an empty with something to start.', c: 'amber' });
    const rows = cands.map(t => { const o = playOpts(t), ok = o.filter(x => !x.dis); return o.length ? { id: 'plon:' + t.id, label: t.rec.name, sub: ok.length ? optsLine(t, ok) : o[0].why, act: 'i:plOn', v: t.id, dis: dis || !ok.length } : null; }).filter(Boolean);
    B.push({ list: rows });
  } else if (P) {
    const t = STU.items.get(P.on), opts = t ? playOpts(t).filter(o => !o.dis) : [];
    B.push({ kv: [['Target', t ? `${t.rec.name} · ${KIND_NAME[t.kind]}` : 'not in the scene']] }, { row: [{ id: 'plback', label: 'Another item...', act: 'i:plBack', dis }] });
    const clips = opts.filter(o => o.what === 'clip'), others = opts.filter(o => o.what !== 'clip');
    if (t && t.kind === 'o' && !t.model) B.push({ p: `${t.rec.name}'s model is not here yet: its animations show once it is.`, c: 'faint' });
    if (clips.length) {
      const row = o => ({ id: 'plwhat:clip:' + o.clip, label: o.clip, sub: o.sub, act: 'i:plWhat', v: 'clip:' + o.clip, on: P.what === 'clip' && P.clip === o.clip, dis });
      const per = 8, pages = Math.max(1, Math.ceil(clips.length / per)), pg = Math.min(P.page, pages - 1);
      B.push({ page: true, label: `Its animations (${clips.length})`, list: clips.map(row) }, { xr: true, label: `Its animations (${clips.length})`, list: clips.slice(pg * per, pg * per + per).map(row) });
      if (pages > 1) B.push({ xr: true, label: `${pg * per + 1} to ${Math.min(clips.length, pg * per + per)} of ${clips.length}`, row: [{ id: 'plpg:-', label: '◂ Previous', act: 'i:plPg', v: -1, dis: pg <= 0 }, { id: 'plpg:+', label: 'Next ▸', act: 'i:plPg', v: 1, dis: pg >= pages - 1 }] });
    }
    if (others.length) B.push({ label: clips.length ? 'Or' : 'What', row: others.map(o => ({ id: 'plwhat:' + o.what, label: o.label, act: 'i:plWhat', v: o.what, on: P.what === o.what, dis })) });
    if (!opts.length) B.push({ p: 'Nothing on it to start now.', c: 'amber' });
    else {
      B.push({ label: 'How', row: PLAY_HOW.map(h => ({ id: 'plhow:' + h, label: HOW_WORD[h], act: 'i:plHow', v: h, on: P.how === h, dis: dis || (h === 'hold' && !holdOk(P.what)) })) });
      if (P.how === 'once' || P.how === 'stop') B.push({ label: 'When', row: [{ id: 'plwhen:enter', label: 'Walking in', act: 'i:plWhen', v: 'enter', on: P.when !== 'leave', dis }, { id: 'plwhen:leave', label: 'Walking out', act: 'i:plWhen', v: 'leave', on: P.when === 'leave', dis }] });
      B.push({ kv: [['It will', playSentence(P, c)]] });
      const same = L.some(e => playKey(e) === playKey(playDraft(P)));
      B.push({ row: [{ id: 'pladd', label: same ? 'Replace' : 'Add', act: 'i:pladd', primary: true, dis: dis || !P.what || (!same && full) }] });
    }
  }
  B.push({ p: PLAY_PARA, c: 'faint' });
}
// the pick's draft as an entry
const playDraft = P => ({ on: P.on, what: P.what, clip: P.what === 'clip' && P.how !== 'stop' ? P.clip : undefined, how: P.how, when: P.when === 'leave' ? 'leave' : undefined });
Object.assign(ITEM_ACT, {
  // the pick: on, or off (Cancel; one pick at a time: Pick what it shows and Change a texture... end); an item chosen (its
  // first option); another item; what, how, when; a page of its animations (a headset's card)
  plPick: c => { if (c.kind === 'c') { STU.plp = STU.plp && STU.plp.id === c.id ? null : { id: c.id, step: 'obj', on: '', what: '', clip: '', how: 'once', when: 'enter', page: 0 }; STU.pick = null; STU.txp = null; } },
  plOn: (c, id) => {
    const P = STU.plp, t = STU.items.get(id);
    if (!P || P.id !== c.id || !t || t.id === c.id) return;
    const o = playOpts(t).filter(x => !x.dis);
    if (!o.length) return;
    Object.assign(P, { step: 'how', on: id, what: o[0].what, clip: o[0].clip || '', page: 0 });
    if (P.how === 'hold' && !holdOk(P.what)) P.how = 'once';
  },
  plBack: c => { if (STU.plp && STU.plp.id === c.id) Object.assign(STU.plp, { step: 'obj', on: '', what: '', clip: '' }); },
  plWhat: (c, v) => {
    const P = STU.plp, t = P && P.id === c.id ? STU.items.get(P.on) : null;
    if (!t) return;
    const s = String(v), what = s.startsWith('clip:') ? 'clip' : s, clip = what === 'clip' ? s.slice(5) : '';
    if (!playOpts(t).some(o => !o.dis && o.what === what && (what !== 'clip' || o.clip === clip))) return;
    P.what = what; P.clip = clip;
    if (P.how === 'hold' && !holdOk(what)) P.how = 'once';
  },
  plHow: (c, v) => {
    const P = STU.plp;
    if (!P || P.id !== c.id || !PLAY_HOW.includes(v) || (v === 'hold' && !holdOk(P.what))) return;
    P.how = v;
    if (v !== 'once' && v !== 'stop') P.when = 'enter';
  },
  plWhen: (c, v) => { const P = STU.plp; if (P && P.id === c.id && (v === 'enter' || v === 'leave') && (P.how === 'once' || P.how === 'stop')) P.when = v; },
  plPg: (c, d) => { if (STU.plp && STU.plp.id === c.id) STU.plp.page = Math.max(0, STU.plp.page + (+d || 0)); },
  plFlash: (c, id) => { STU.flash = STU.items.has(id) ? { id, at: performance.now(), play: true } : null; },
  // Try: the entry fired here now as if entered (a loop or a hold comes off after 10 s, unless its cube is active for you);
  // pressed while it plays, it comes off. This device's own: no Undo step, nothing written
  plTry: (c, k) => {
    const e = (c.rec.plays || [])[+k];
    if (!e) return;
    trgList();
    const T = trgClock(), t = STU.items.get(e.on), R = t && t.tr && t.tr[e.what];
    if (R && !R.off && R.ek === playEk(c, e) && e.how !== 'stop') { trgOff(R, T, 'try'); return; }
    if (!TRG.seen.has(playEk(c, e))) TRG.seen.set(playEk(c, e), 1);
    trgStart({ c, e, ek: playEk(c, e) }, T, true);
  },
  pladd: c => {
    const P = STU.plp;
    if (c.kind !== 'c' || !P || P.id !== c.id || P.step !== 'how' || !P.what) return;
    const d = normPlays([playDraft(P)])[0];
    if (!d) return;
    const L = (c.rec.plays || []).slice(), i = L.findIndex(e => playKey(e) === playKey(d));
    if (i >= 0) L[i] = d; else if (L.length >= PLAY_MAX) return; else L.push(d);
    setRec(c.id, { plays: L });
    STU.plp = null;
  },
  unplay: (c, k) => { const L = (c.rec.plays || []).slice(); if (!(+k >= 0 && +k < L.length)) return; L.splice(+k, 1); setRec(c.id, { plays: L.length ? L : undefined }); },
});
PANE_ONLY.push('plPick', 'plOn', 'plBack', 'plWhat', 'plHow', 'plWhen', 'plPg', 'plFlash', 'plTry');
// for tests: what fired, the items with runs, and with an item's id what runs on it now
function playState(id) {
  const it = id && STU.items.get(id), out = { log: TRG.log.slice(), on: [...TRG.on].map(t => t.id) };
  if (it) {
    const tr = {};
    for (const k of PLAY_WHAT) { const R = it.tr && it.tr[k]; if (R) tr[k] = { cube: R.c.id, clip: R.e.clip || '', how: R.e.how, when: R.e.when || 'enter', at: R.at, off: R.off, try: R.try, n: R.n }; }
    out.item = { tgM: it.tgM || 0, tr, layers: it.tl ? it.tl.map(y => [y.R.e.clip, +y.w.toFixed(3), +y.t.toFixed(3), !!y.fadeAt]) : [], pw: it.pw || 0, tg: it.tg == null ? null : it.tg, trgLog: it.trgLog || null };
  }
  return out;
}

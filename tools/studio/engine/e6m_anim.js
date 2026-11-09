
// ============================================================== TIMELINE ==
// A selected item's timeline while editing (v127; the owner, 9 November 2026: "items that have an animation should show
// a timeline and play pause in edit mode when selected", then "play and pause for everyone in the circle", "pause and
// scrubbing is temporary, once the item is not selected anymore or editing is switched off it goes back to its regular
// behaviour"). Two timelines (channels), each with a hold of its own:
// - 'clip' (v127): the card of an object whose clip plays (Loop or Once), under its Animation rows;
// - 'path' (v128; the owner: "please add timeline and play pause also for recorded items"): the card of an object, a shape,
//   an empty or a sound with a recorded path (e6f_path.js), under its Recorded path rows, not while it is recorded. What
//   it holds is the path's own clock (the item's time the pose pipeline reads, before its speed, Loop, Once or Back and
//   forth: pathTime), so its range is one cycle of what is seen: its length at its speed, twice that for Back and forth.
// Each shows where it is, Play / Pause, Start, a second back and on, The scene's clock, on a page a slider, and on a
// headset's card a bar to point at and drag (e9_panels.js: drawBar). A press holds it here (ANIM.mine, the clip's;
// ANIM.mineP, the path's: its time t at the clock's at, playing or not), and at a station this device tells everyone at its
// circle, as a quiet effect of the studio's ('anim', a few times a second and at once on each change: { at, a: [id, t, p] },
// with c: 'p' for a path), so they draw the same moment. Nothing is stored or saved: no record changes, no Undo step, no
// FORMAT change. It lets go (back to the scene's clock, or from when shown, for everyone) when the item is no longer
// selected here, editing is off, its clip stops or changes (its path is deleted, recorded again, or its play, start or
// speed changed; a recording starts), or The scene's clock is pressed; a device that hears nothing for 1.2 s lets go by
// itself. Two holding one item at once: the latest word wins on the others; each sees its own. A path's voice (a sound
// recorded with it, e6j_voice.js: syncAt) follows its hold: silent while it is held paused, from the matching moment while
// it is held playing, back on the path's clock once let go
const ANIM = { mine: null, mineP: null, heard: new Map(), sent: { clip: 0, path: 0 }, drag: '', sigPage: '', log: null, n: 0 };
const ANIM_SEND = 250, ANIM_FRESH = 1200;
// (ms: the relay's clock at a station, the same moment everywhere; else this page's: behNow, e6g_behave.js)
const animNow = () => behNow();
const ANIM_CHS = ['clip', 'path'];
// a path's one cycle of what is seen (s of its item's time): its length at its speed, there and back for Back and forth
const pathCycle = P => pathLen(P) / P.speed * (P.play === 'bounce' ? 2 : 1);
// what a path's hold was made for: deleted, recorded again, or its play, start or speed changed, it lets go
const pathKeyOf = P => (!P ? '' : [P.src || '', P.k ? [P.k.length, P.k[Math.floor(P.k.length / 2)].join(), P.k[P.k.length - 1].join()].join(':') : P.len + ':' + P.n, P.play, P.start, P.speed].join('|'));
// each channel: whether it shows for an item, its length (s), whether it wraps round (else held at its ends), what its hold
// is made for, its own time now (unheld), its buttons' and slider's names
const ANIM_C = {
  clip: { can: it => it.kind === 'o' && !!it.action && it.dur > 0 && it.rec.anim !== 'off', dur: it => it.dur, loop: it => it.rec.anim === 'loop', key: it => it.animKey,
    clock: (it, now) => (it.rec.start === 'shown' ? (now - it.shownAt) / 1000 : sceneClock(now)), act: 'an:', range: 'stuRangeAnim', bar: 'anbar', what: 'animation' },
  path: { can: it => !!pathOf(it) && pathLen(pathOf(it)) > 0 && !recording(it), dur: it => pathCycle(pathOf(it)), loop: it => pathOf(it).play !== 'once', key: it => pathKeyOf(pathOf(it)),
    clock: (it, now) => pathClock(it, pathOf(it), now, sceneClock(now)), act: 'ap:', range: 'stuRangePath', bar: 'apbar', what: 'recorded path' },
};
const mineOf = ch => (ch === 'path' ? ANIM.mineP : ANIM.mine);
const heardKey = (id, ch) => (ch === 'path' ? id + ':p' : id);
// the hold that applies to an item's channel here: this device's own, else a fresh one heard, else null
function animHold(it, ch = 'clip') {
  const m = mineOf(ch);
  if (m && m.id === it.id) return m;
  const k = heardKey(it.id, ch), h = ANIM.heard.get(k);
  if (h && performance.now() - h.got > ANIM_FRESH) { ANIM.heard.delete(k); return null; }
  return h || null;
}
// a time in its channel's range (a Loop, or a path going back and forth, wraps round; Once stops at its end)
function animWrap(it, t, ch = 'clip') {
  const C = ANIM_C[ch], d = C.can(it) ? C.dur(it) : 0;
  if (!(d > 0)) return 0;
  return C.loop(it) ? ((t % d) + d) % d : Math.min(Math.max(0, t), d - 1e-4);
}
// where a hold has it now (its time, moved on since if it plays)
const animAt = (it, H, ch = 'clip') => animWrap(it, H.p ? H.t + (animNow() - H.at) / 1000 : H.t, ch);
// where it is now here (held, or on the scene's clock, or from when shown)
function animTime(it, ch = 'clip') {
  const C = ANIM_C[ch];
  if (!it || !C.can(it)) return 0;
  const H = animHold(it, ch);
  return H ? animAt(it, H, ch) : animWrap(it, C.clock(it, performance.now()), ch);
}
// can a channel's timeline show for this item here: selected while editing, and the channel has something to play
const animCan = (it, ch = 'clip') => !!it && editOn() && STU.sel === it.id && ANIM_C[ch].can(it);
// this device's hold set (t at now, playing or not) and told at once (quiet: a page's slider or a headset's bar moving:
// told a few times a second, as while it holds, and its pane not drawn again under the hand)
function animSet(it, t, p, quiet, ch = 'clip') {
  if (!animCan(it, ch)) return;
  const h = { id: it.id, t: animWrap(it, t, ch), p: !!p, at: animNow(), key: ANIM_C[ch].key(it), n: ++ANIM.n };
  if (ch === 'path') ANIM.mineP = h; else ANIM.mine = h;
  if (!quiet) ANIM.sent[ch] = 0;
  animSend(ch);
  if (!quiet) dirty(true);
}
function animFree(why, ch = 'clip') {
  const m = mineOf(ch);
  if (!m) return;
  if (ch === 'path') ANIM.mineP = null; else ANIM.mine = null;
  if (atStation()) { try { HOST.collab.effect('anim', Object.assign({ at: Math.round(animNow()), a: [m.id], end: 1 }, ch === 'path' ? { c: 'p' } : {}), true); } catch (e) { /* not in a room now */ } }
  if (ANIM.log) ANIM.log.push(['free', m.id, why || '', ch]);
  dirty(true);
}
function animSend(ch = 'clip') {
  const m = mineOf(ch);
  if (!m || !atStation()) return;
  const now = performance.now();
  if (now - ANIM.sent[ch] < ANIM_SEND) return;
  ANIM.sent[ch] = now;
  // (its time at this moment, so a late word is still right: at is the relay's time)
  const it = STU.items.get(m.id), T = animNow(), d = { at: Math.round(T), a: [m.id, +(it && ANIM_C[ch].can(it) ? animAt(it, m, ch) : m.t).toFixed(3), m.p ? 1 : 0] };
  if (ch === 'path') d.c = 'p';
  try { HOST.collab.effect('anim', d, true); } catch (e) { /* not in a room now */ }
}
// each frame: this device's holds let go where they no longer apply, else told now and then
function animStep2() {
  for (const ch of ANIM_CHS) {
    const m = mineOf(ch);
    if (!m) continue;
    const it = STU.items.get(m.id), C = ANIM_C[ch];
    const why = !it ? 'gone' : !editOn() ? 'edit' : STU.sel !== m.id ? 'sel' : ch === 'path' && REC ? 'rec' : !C.can(it) || C.key(it) !== m.key ? ch : '';
    if (why) animFree(why, ch); else animSend(ch);
  }
  animCardStep();
}
// whether a word heard says what the hold kept says already (the same holder, playing or not alike, at the same moment
// within 30 ms): told a few times a second, it is kept as it was, so a path's voice is not started again each time
function animSame(id, ch, H, t, at) {
  const it = STU.items.get(id), C = ANIM_C[ch];
  if (!it || !C.can(it)) return false;
  const d = C.dur(it), e = animWrap(it, H.p ? H.t + (at - H.at) / 1000 : H.t, ch) - animWrap(it, t, ch);
  return Math.abs(C.loop(it) ? e - d * Math.round(e / d) : e) < 0.03;
}
// a word from another device at the circle (studioEffect): its hold, or its end (c: 'p', a recorded path's)
function animHeard(d, by) {
  if (!d || !Array.isArray(d.a) || !okId(d.a[0])) return;
  const id = d.a[0], ch = d.c === 'p' ? 'path' : 'clip', k = heardKey(id, ch), was = ANIM.heard.get(k), now = performance.now();
  if (d.end) { if (!was || was.by === by) ANIM.heard.delete(k); return; }
  if (!fin(d.a[1]) || !fin(d.at)) return;
  const t = +d.a[1], p = !!d.a[2], at = +d.at, fresh = was && now - was.got < ANIM_FRESH;
  if (fresh && was.by !== by && was.last > at) return;   // (an older word from another holder)
  if (fresh && was.by === by && was.p === p && animSame(id, ch, was, t, at)) { was.got = now; was.last = at; return; }
  ANIM.heard.set(k, { t, p, at, by, got: now, last: at, n: ++ANIM.n, ch });
}
// the card's buttons (page and headset): Play / Pause, Start, a second back and on, The scene's clock (an: the clip's, ap:
// the path's)
const animSel = () => STU.items.get(STU.sel);
function animActs(ch) {
  const P = ANIM_C[ch].act;
  return {
    [P + 'play']: () => { const it = animSel(); if (!animCan(it, ch)) return; const H = animHold(it, ch); animSet(it, animTime(it, ch), !(H ? H.p : true), false, ch); },
    [P + 'start']: () => { const it = animSel(); if (animCan(it, ch)) animSet(it, 0, false, false, ch); },
    // (a second back or on: round a Loop, held at the ends of Once, as animSet's animWrap keeps it)
    [P + 'step']: v => { const it = animSel(); if (!animCan(it, ch)) return; const H = animHold(it, ch); animSet(it, animTime(it, ch) + (+v || 0), H ? H.p : false, false, ch); },
    [P + 'free']: () => animFree('button', ch),
  };
}
const ANIM_ACT = Object.assign(animActs('clip'), animActs('path'));
// the page's slider (tenths of a second): held there, playing on if it was
function animSeek(v, done, ch = 'clip') {
  const it = animSel();
  if (!animCan(it, ch)) return;
  const m = mineOf(ch), H = m && m.id === it.id ? m : null;
  ANIM.drag = done ? '' : ch;
  animSet(it, Math.min(Math.max(0, v / 10), ANIM_C[ch].dur(it) - 1e-4), H ? H.p : false, !done, ch);
}
// a headset's bar pointed at and dragged (f: 0 at its start, 1 at its end): held there, paused, for everyone at the circle;
// let go, it stays held there (its last place told within a quarter of a second, animStep2)
function animScrub(ch, f) {
  const it = animSel();
  if (!animCan(it, ch)) return;
  const d = ANIM_C[ch].dur(it);
  animSet(it, Math.min(Math.max(0, f), 1) * d, false, true, ch);
}
const animTxt = (t, d) => `${t.toFixed(1)} s of ${d.toFixed(1)} s`;
// the rows of a channel's timeline (after an object's Animation rows: clip; after the Recorded path rows: path)
function animBlocks(it, B, ch = 'clip') {
  if (!animCan(it, ch)) return;
  const C = ANIM_C[ch], P = C.act, d = C.dur(it), H = animHold(it, ch), m = mineOf(ch), mine = !!(m && m.id === it.id), t = animTime(it, ch), room = atStation(), p = H ? H.p : true;
  const unheld = ch === 'path' ? (pathOf(it).start === 'shown' ? 'from when it was shown' : pathOf(it).play === 'once' && it.again != null ? 'from Start again' : null) : it.rec.start === 'shown' ? 'from when it was shown' : null;
  const who = !H ? (unheld || (room ? 'on the scene\'s clock, the same for everyone here' : 'on the scene\'s clock'))
    : mine ? (room ? 'held by you, for everyone at this circle' : 'held here') : 'held by someone else at this circle';
  const row = [
    { id: P + 'play', label: p ? 'Pause' : 'Play', act: P + 'play', on: !!H && !H.p },
    { id: P + 'start', label: 'Start', act: P + 'start' },
    { id: P + 'back', label: '−1 s', act: P + 'step', v: -1 },
    { id: P + 'on', label: '+1 s', act: P + 'step', v: 1 },
    { id: P + 'free', label: 'The scene\'s clock', act: P + 'free', on: !H, dis: !mine },
  ];
  // (a page's label follows the time, animCardStep; a headset's says how it plays, its bar the time: drawn again only as
  // that changes, the bar's strip on its own, e9_panels.js)
  B.push({ page: true, label: 'Timeline: ' + animTxt(t, d), row },
    { xr: true, label: `Timeline (${d.toFixed(1)} s): ` + (!H ? 'playing' : (H.p ? 'held, playing' : 'held, paused') + (mine ? '' : ' by someone else')), row },
    { xr: true, bar: { id: C.bar, ch } });
  B.push({ page: true, range: { id: C.range, act: P + 'seek', v: '', min: 0, max: Math.max(1, Math.round(d * 10)), step: 1, value: Math.round(t * 10), out: t.toFixed(1) + ' s', fmt: 's', aria: `Where the ${C.what} is, in seconds` } });
  // (the line under it on a page only: a headset's card keeps its place and size rows in sight)
  const what = ch === 'path' ? (H ? 'Its recorded path is ' : 'Its recorded path plays ') : 'It plays ';
  B.push({ page: true, p: what + who + '. Pause, the slider or a step holds it there ' + (room ? 'for everyone at this circle' : 'here') + ' while it stays selected and editing is on; then it goes back to playing as before.' + (ch === 'path' && pathOf(it).play === 'bounce' ? ' Back and forth: there and back is one cycle.' : ''), c: 'faint' });
}
// a page's card: each timeline's time and slider follow it every frame (the pane is not drawn again for that), unless its
// slider is being moved
function animCardStep() {
  if (XR.on || APP.mode !== 'explore') return;
  const it = STU.items.get(STU.sel);
  for (const ch of ANIM_CHS) {
    const s = document.getElementById(ANIM_C[ch].range);
    if (!s || !animCan(it, ch)) continue;
    const t = animTime(it, ch), o = s.parentNode && s.parentNode.querySelector('[data-range-out]');
    if (ANIM.drag !== ch) s.value = Math.round(t * 10);
    if (o) o.textContent = t.toFixed(1) + ' s';
    const l = s.closest('.stu-range') && s.closest('.stu-range').previousElementSibling;
    const tl = l && l.previousElementSibling && l.previousElementSibling.classList.contains('stu-l') ? l.previousElementSibling : null;
    if (tl && /^Timeline: /.test(tl.textContent)) tl.textContent = 'Timeline: ' + animTxt(t, ANIM_C[ch].dur(it));
  }
}
// what the panes follow: who holds each timeline and whether it plays (the page's time goes in by animCardStep, the
// headset's bar by its own strip, drawBar)
function animSig(xr) {
  const it = STU.items.get(STU.sel);
  if (!xr && ANIM.drag && !animCan(it, ANIM.drag)) ANIM.drag = '';   // (its timeline gone from under the hand)
  if (!xr && ANIM.drag) return ANIM.sigPage;   // (a slider held: the pane stays as it is under the hand)
  const s = ANIM_CHS.map(ch => { if (!animCan(it, ch)) return ''; const H = animHold(it, ch), m = mineOf(ch); return ch[0] + (H ? (m && m.id === it.id ? 'm' : 'h') + +H.p : '-'); }).join('');
  if (!xr) ANIM.sigPage = s;
  return s;
}
// what a headset's bar shows now (null: nothing to show): its time, length, whether it is held, plays, is this device's
function animBar(ch) {
  const it = STU.items.get(STU.sel);
  if (!animCan(it, ch)) return null;
  const H = animHold(it, ch), m = mineOf(ch);
  return { t: animTime(it, ch), d: ANIM_C[ch].dur(it), held: !!H, p: H ? H.p : true, mine: !!(m && m.id === it.id) };
}
const animState = () => ({ mine: ANIM.mine && Object.assign({}, ANIM.mine), mineP: ANIM.mineP && Object.assign({}, ANIM.mineP), heard: Object.fromEntries([...ANIM.heard].map(([k, v]) => [k, Object.assign({}, v)])) });

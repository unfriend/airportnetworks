
// ============================================================== TIMELINE ==
// A selected model's animation while editing (v127; the owner, 9 November 2026: "items that have an animation should show
// a timeline and play pause in edit mode when selected", then "play and pause for everyone in the circle", "pause and
// scrubbing is temporary, once the item is not selected anymore or editing is switched off it goes back to its regular
// behaviour"). The card of an object whose clip plays (Loop or Once) shows where the clip is, Play / Pause, Start, a
// second back and on, The scene's clock, and on a page a slider. A press holds the clip here (ANIM.mine: the clip's time
// t at the clock's at, playing or not), and at a station this device tells everyone at its circle, as a quiet effect of
// the studio's ('anim', a few times a second and at once on each change: { at, a: [id, t, p] }), so they draw the same
// frame. Nothing is stored or saved: no record changes, no Undo step, no FORMAT change. It lets go (back to the scene's
// clock, or from when shown, for everyone) when the object is no longer selected here, editing is off, its clip stops
// or changes, or The scene's clock is pressed; a device that hears nothing for 1.2 s lets go by itself. Two holding one
// object at once: the latest word wins on the others; each sees its own
const ANIM = { mine: null, heard: new Map(), sent: 0, drag: false, sigPage: '', log: null };
const ANIM_SEND = 250, ANIM_FRESH = 1200;
// (ms: the relay's clock at a station, the same moment everywhere; else this page's: behNow, e6g_behave.js)
const animNow = () => behNow();
// the hold that applies to an item here: this device's own, else a fresh one heard, else null
function animHold(it) {
  if (ANIM.mine && ANIM.mine.id === it.id) return ANIM.mine;
  const h = ANIM.heard.get(it.id);
  if (h && performance.now() - h.got > ANIM_FRESH) { ANIM.heard.delete(it.id); return null; }
  return h || null;
}
// a clip's time in its range (Loop wraps round, Once stops at its end)
function animWrap(it, t) {
  const d = it.dur;
  return it.rec.anim === 'loop' ? ((t % d) + d) % d : Math.min(Math.max(0, t), d - 1e-4);
}
// where a hold has the clip now (its time, moved on since if it plays)
const animAt = (it, H) => animWrap(it, H.p ? H.t + (animNow() - H.at) / 1000 : H.t);
// where the clip is now here (held, or on the scene's clock, or from when shown)
function animTime(it) {
  if (!it.action || !(it.dur > 0)) return 0;
  const H = animHold(it);
  if (H) return animAt(it, H);
  const now = performance.now();
  return animWrap(it, it.rec.start === 'shown' ? (now - it.shownAt) / 1000 : sceneClock(now));
}
// can the timeline show for this item here: an object selected while editing whose clip plays
const animCan = it => !!it && it.kind === 'o' && editOn() && STU.sel === it.id && !!it.action && it.dur > 0 && it.rec.anim !== 'off';
// this device's hold set (t at now, playing or not) and told at once (quiet: a page's slider moving, its pane not drawn
// again under the hand until it is let go)
function animSet(it, t, p, quiet) {
  if (!animCan(it)) return;
  ANIM.mine = { id: it.id, t: animWrap(it, t), p: !!p, at: animNow(), key: it.animKey };
  ANIM.sent = 0;
  animSend();
  if (!quiet) dirty(true);
}
function animFree(why) {
  const m = ANIM.mine;
  if (!m) return;
  ANIM.mine = null;
  if (atStation()) { try { HOST.collab.effect('anim', { at: Math.round(animNow()), a: [m.id], end: 1 }, true); } catch (e) { /* not in a room now */ } }
  if (ANIM.log) ANIM.log.push(['free', m.id, why || '']);
  dirty(true);
}
function animSend() {
  const m = ANIM.mine;
  if (!m || !atStation()) return;
  const now = performance.now();
  if (now - ANIM.sent < ANIM_SEND) return;
  ANIM.sent = now;
  // (the clip's time at this moment, so a late word is still right: at is the relay's time)
  const it = STU.items.get(m.id), T = animNow();
  try { HOST.collab.effect('anim', { at: Math.round(T), a: [m.id, +(it ? animAt(it, m) : m.t).toFixed(3), m.p ? 1 : 0] }, true); } catch (e) { /* not in a room now */ }
}
// each frame: this device's hold let go where it no longer applies, else told now and then
function animStep2() {
  const m = ANIM.mine;
  if (m) {
    const it = STU.items.get(m.id);
    if (!it || !editOn() || STU.sel !== m.id || !it.action || !(it.dur > 0) || it.rec.anim === 'off' || it.animKey !== m.key) animFree(!it ? 'gone' : !editOn() ? 'edit' : STU.sel !== m.id ? 'sel' : 'clip');
    else animSend();
  }
  animCardStep();
}
// a word from another device at the circle (studioEffect): its hold, or its end
function animHeard(d, by) {
  if (!d || !Array.isArray(d.a) || !okId(d.a[0])) return;
  const id = d.a[0], was = ANIM.heard.get(id);
  if (d.end) { if (!was || was.by === by) ANIM.heard.delete(id); return; }
  if (!fin(d.a[1]) || !fin(d.at)) return;
  if (was && was.by !== by && was.at > d.at && performance.now() - was.got < ANIM_FRESH) return;   // (an older word from another holder)
  ANIM.heard.set(id, { t: +d.a[1], p: !!d.a[2], at: +d.at, by, got: performance.now() });
}
// the card's buttons (page and headset): Play / Pause, Start, a second back and on, The scene's clock; a page's slider
const ANIM_ACT = {
  'an:play': () => { const it = STU.items.get(STU.sel); if (!animCan(it)) return; const H = animHold(it); animSet(it, animTime(it), !(H ? H.p : true)); },
  'an:start': () => { const it = STU.items.get(STU.sel); if (animCan(it)) animSet(it, 0, false); },
  'an:step': v => { const it = STU.items.get(STU.sel); if (!animCan(it)) return; const H = animHold(it); animSet(it, Math.min(Math.max(0, animTime(it) + (+v || 0)), it.dur - 1e-4), H ? H.p : false); },
  'an:free': () => animFree('button'),
};
// the page's slider (tenths of a second): the clip held there, playing on if it was
function animSeek(v, done) {
  const it = STU.items.get(STU.sel);
  if (!animCan(it)) return;
  const H = ANIM.mine && ANIM.mine.id === it.id ? ANIM.mine : null;
  ANIM.drag = !done;
  animSet(it, Math.min(Math.max(0, v / 10), it.dur - 1e-4), H ? H.p : false, !done);
}
const animTxt = (t, d) => `${t.toFixed(1)} s of ${d.toFixed(1)} s`;
// the rows, after the Animation rows of an object's card
function animBlocks(it, B) {
  if (!animCan(it)) return;
  const H = animHold(it), mine = !!(ANIM.mine && ANIM.mine.id === it.id), t = animTime(it), room = atStation(), p = H ? H.p : true;
  const who = !H ? (it.rec.start === 'shown' ? 'from when it was shown' : room ? 'on the scene\'s clock, the same for everyone here' : 'on the scene\'s clock')
    : mine ? (room ? 'held by you, for everyone at this circle' : 'held here') : 'held by someone else at this circle';
  B.push({ label: 'Timeline: ' + animTxt(t, it.dur), row: [
    { id: 'an:play', label: p ? 'Pause' : 'Play', act: 'an:play', on: !!H && !H.p },
    { id: 'an:start', label: 'Start', act: 'an:start' },
    { id: 'an:back', label: '−1 s', act: 'an:step', v: -1 },
    { id: 'an:on', label: '+1 s', act: 'an:step', v: 1 },
    { id: 'an:free', label: 'The scene\'s clock', act: 'an:free', on: !H, dis: !mine },
  ] });
  B.push({ page: true, range: { id: 'stuRangeAnim', act: 'an:seek', v: '', min: 0, max: Math.max(1, Math.round(it.dur * 10)), step: 1, value: Math.round(t * 10), out: t.toFixed(1) + ' s', fmt: 's', aria: 'Where the animation is, in seconds' } });
  // (the line under it on a page only: a headset's card keeps its place and size rows in sight)
  B.push({ page: true, p: 'It plays ' + who + '. Pause, a slider or a step holds it there ' + (room ? 'for everyone at this circle' : 'here') + ' while it stays selected and editing is on; then it goes back to playing as before.', c: 'faint' });
}
// a page's card: the time and the slider follow the clip every frame (the pane is not drawn again for that), unless the
// slider is being moved
function animCardStep() {
  if (XR.on || APP.mode !== 'explore') return;
  const s = document.getElementById('stuRangeAnim');
  if (!s) return;
  const it = STU.items.get(STU.sel);
  if (!animCan(it)) return;
  const t = animTime(it), o = s.parentNode && s.parentNode.querySelector('[data-range-out]');
  if (!ANIM.drag) s.value = Math.round(t * 10);
  if (o) o.textContent = t.toFixed(1) + ' s';
  const l = s.closest('.stu-range') && s.closest('.stu-range').previousElementSibling;
  const tl = l && l.previousElementSibling && l.previousElementSibling.classList.contains('stu-l') ? l.previousElementSibling : null;
  if (tl && /^Timeline: /.test(tl.textContent)) tl.textContent = 'Timeline: ' + animTxt(t, it.dur);
}
// what the panes follow: the page's (who holds it, playing or not; the time goes in by animCardStep), the headset's (its
// card drawn again every half second while the timeline shows)
function animSig(xr) {
  if (!xr && ANIM.drag) return ANIM.sigPage;   // (the slider held: the pane stays as it is under the hand)
  const it = STU.items.get(STU.sel);
  if (!animCan(it)) { if (!xr) ANIM.drag = false; return (xr ? '' : (ANIM.sigPage = '')); }
  const H = animHold(it), s = [H ? (ANIM.mine && ANIM.mine.id === it.id ? 'm' : 'h') + +H.p : '-', xr ? Math.floor(animTime(it) * 2) : ''].join('');
  if (!xr) ANIM.sigPage = s;
  return s;
}
const animState = () => ({ mine: ANIM.mine && Object.assign({}, ANIM.mine), heard: Object.fromEntries([...ANIM.heard].map(([k, v]) => [k, Object.assign({}, v)])) });

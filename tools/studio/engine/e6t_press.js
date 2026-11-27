// ========================================================= PRESSED AND POINTED AT ==
// An object or a shape may react when it is pressed, and while it is pointed at (v146; the owner, 15 November 2026: "press
// an item (anyone, visitors too, editing off too) ... does what a cube can start or starts a sequence; plus 'only while
// pointed at' (hover) reactions"; docs/agents/studio.md, "Press and hover"). Its record's press:
//   press: { do: [entries], hover: [entries], who }   (kept only when it has an entry; who: 'own' or absent, everyone)
// each entry { on, what, clip?, how?, fade? }: the item it acts on (often itself), what ('clip', 'sound', 'path', 'motion',
// 'show', 'hide' or 'seq': what a cube's entry or a sequence's event does), how (once, loop, stop; hold too for a clip or a
// path while pointed at; a loop in 'do' toggles: pressed again it stops) and, for show and hide, fade ('cut': at once).
// A press is a stamp, never a record: pr.<itemId> = { n, at, by } in the room's state (this device's own, STU.prOwn, with who
// 'own'), written by the presser with no Undo step, never in layout.json, the draft or Unsaved changes. Every device works the
// result out from the stamp and the room's time, a late joiner too: a once started long ago is over, a loop starts when n is
// odd, what a press showed or hid stays until another source decides (the cubes' "entered last decides" rule). Pointing is
// each person's own and sends nothing. A press fires only without editing (a click or the trigger then selects, as ever);
// the card's Try press and Try pointing fire it here
const PRESS_KINDS = ['o', 'p'], PRESS_MAX = 16, PRESS_GAP = 250, PRESS_WHAT = ['clip', 'sound', 'path', 'motion', 'show', 'hide', 'seq'];
const PRESS = { rev: -1, list: [], hov: '', hovPage: '', fake: null, tryHov: null, hv: new Map(), last: new Map(), mine: new Map(), try: new Map(), pt: 0, dn: null, log: [], said: 0 };
Object.assign(STU, { pr: new Map(), prOwn: new Map(), prp: null });

// ---------------------------------------------------------------- the record --
// a list's entries as a record keeps them: one that is not one dropped, as is a second for the same item and what, at most 16,
// the order kept; fields in this order: on, what, clip, how, fade
function normPressList(list, kind) {
  const out = [], seen = new Set();
  for (const e of list) {
    if (out.length >= PRESS_MAX) break;
    if (!e || typeof e !== 'object' || Array.isArray(e) || !okId(e.on) || !PRESS_WHAT.includes(e.what)) continue;
    const r = { on: e.on, what: e.what };
    if (e.what === 'show' || e.what === 'hide') {
      if (e.fade !== undefined && e.fade !== null && e.fade !== 'cut') continue;
      if (e.fade === 'cut') r.fade = 'cut';
    } else {
      const how = e.how === undefined ? 'once' : e.how, hold = kind === 'hover' && (e.what === 'clip' || e.what === 'path');
      if (!(how === 'once' || how === 'loop' || how === 'stop' || (how === 'hold' && hold))) continue;
      if (e.what === 'clip' && how !== 'stop') { if (typeof e.clip !== 'string' || !e.clip.trim()) continue; r.clip = e.clip.slice(0, 120); }
      r.how = how;
    }
    const k = r.on + '|' + r.what;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}
// the record's press: null a bad one, false none (no entry), else { do?, hover?, who? }
function normPressRec(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  for (const k of ['do', 'hover']) if (x[k] !== undefined && x[k] !== null && !Array.isArray(x[k])) return null;
  if (x.who !== undefined && x.who !== null && x.who !== 'own' && x.who !== 'all') return null;
  const d = x.do ? normPressList(x.do, 'do') : [], h = x.hover ? normPressList(x.hover, 'hover') : [], sn = sendKeep(x.send, 'press');   // (its sends, v157: e6u_send.js)
  if (sn === null) return null;
  if (!d.length && !h.length && !sn) return false;
  const r = {};
  if (d.length) r.do = d;
  if (h.length) r.hover = h;
  if (sn) r.send = sn;
  if (x.who === 'own') r.who = 'own';
  return r;
}
// a stamp as the room keeps it (null: not one)
function normPr(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const { n, at } = v;
  if (!Number.isInteger(n) || n < 0 || !fin(at) || at < 0) return null;
  return { n, at: Math.round(at), by: typeof v.by === 'string' ? words(v.by, 40) : '' };
}
const prMap = it => (it.rec.press && it.rec.press.who === 'own' ? STU.prOwn : STU.pr);
const prEntries = p => (p.do || []).concat(p.hover || []);
const prKinds = what => (what === 'show' || what === 'hide' ? SEQ_SHOW : what === 'seq' ? ['q'] : PLAY_KINDS[what]);
const prRun = what => SEQ_RUN.includes(what) || what === 'seq';
// the items with a press, made again when the items change
function pressRev() {
  if (PRESS.rev === STU.rev) return;
  PRESS.rev = STU.rev;
  PRESS.list = [];
  for (const it of STU.items.values()) if (it.rec && it.rec.press && PRESS_KINDS.includes(it.kind)) PRESS.list.push(it);
}
// whether it can be pressed or pointed at now: not while editing (a click or the trigger selects), shown here, in a scene
const pressable = it => !!(it && PRESS_KINDS.includes(it.kind) && it.rec && it.rec.press && it.shown && !it.notHere && STU.scene && !editOn() && it.holder && it.holder.visible);

// ----------------------------------------------------------------- pressing --
// a press here: the stamp written (no Undo step), fired by pressStep this frame (and by every other device from the room's
// state). At most one press of an item every 250 ms from this device. False: nothing happened
function pressFire(id) {
  const it = STU.items.get(id);
  // (an item with only send entries is pressable too: a press writes its stamp, which the output page sends; v157)
  if (!it || !PRESS_KINDS.includes(it.kind) || !it.rec.press || !((it.rec.press.do && it.rec.press.do.length) || (it.rec.press.send && it.rec.press.send.length))) return false;
  const now = performance.now(), L = PRESS.last.get(id);
  if (L !== undefined && now - L < PRESS_GAP) return false;
  PRESS.last.set(id, now);
  const M = prMap(it), prev = M.get(id), n = (prev ? prev.n : 0) + 1;
  M.set(id, { n, at: Math.round(behNow()), by: M === STU.pr ? seqWho() : '' });
  PRESS.mine.set(id, n);
  PRESS.log.push([id, n, Math.round(behNow())]); if (PRESS.log.length > 100) PRESS.log.shift();
  dirty();
  return true;
}
// the trigger or a click on a pressable item: a press (a buzz and the pick sound), or a soft tick when it was ignored
function pressGo(id, point, c) {
  const ok = pressFire(id);
  if (ok) { if (c) buzz(c, 0.3, 25); sfxAct('pick', 'world', point ? point.toArray() : null); } else sfxAct('hover', 'world', point ? point.toArray() : null);
  return ok;
}
// Try press (the card): this device's own stamp, nothing written
function pressTry(it) {
  if (!it || !it.rec.press || !(it.rec.press.do && it.rec.press.do.length)) return;
  const prev = PRESS.try.get(it.id);
  PRESS.try.set(it.id, { n: (prev ? prev.n : 0) + 1, at: Math.round(behNow()), by: '' });
}
function pressTryHover(it) { if (it && it.rec.press && it.rec.press.hover) PRESS.tryHov = { id: it.id, until: performance.now() + 3000 }; }

// ------------------------------------------------------------ each frame --
// the item pointed at now ('' none): a pretend one (the tests), the card's Try pointing, else a headset's rays or the page's pointer
function hoverNow() {
  if (PRESS.tryHov) { if (performance.now() < PRESS.tryHov.until) return PRESS.tryHov.id; PRESS.tryHov = null; }
  if (PRESS.fake !== null) return PRESS.fake;
  if (editOn() || !STU.scene) return '';
  if (XR.on && GL.renderer.xr.isPresenting) {
    for (const c of XR.ctrls || []) { const h = c.hover; if (h && h.kind === 'item') { const it = STU.items.get(h.id); if (pressable(it)) return it.id; } }
    return '';
  }
  return PRESS.hovPage && pressable(STU.items.get(PRESS.hovPage)) ? PRESS.hovPage : '';
}
// a source of show or hide for the cubes' rule (the same object each frame for an entry: S and H hold it for one frame)
function prSrc(it, key, since, cut) {
  const m = it.psrc || (it.psrc = new Map());
  let s = m.get(key);
  if (!s) m.set(key, (s = { id: it.id, since: 0, cut: false }));
  s.since = since; s.cut = cut; s.hv = key[0] === 'h';   // (pointing's, for a cube's card: v154)
  return s;
}
// in triggerStep after the cubes and the sequences: what pointing now is (begun, kept 0.3 s after it ends), then each item's
// show and hide entries as sources: a press's persistent (from its stamp's moment), a hover's while pointed at
function pressShowHide(S, H, Tr) {
  pressRev();
  const id = hoverNow();
  for (const [k, h] of PRESS.hv) {
    if (k === id) { if (h.off && Tr - h.off < PLAY_EDGE) h.off = 0; else if (h.off) { /* over: pressStep ends it, a new one begins after */ } }
    else if (!h.off) h.off = Tr;
  }
  if (id && !PRESS.hv.has(id)) { const it = STU.items.get(id); if (it && it.rec.press && it.rec.press.hover) { PRESS.hv.set(id, { at: Tr, off: 0, fired: false }); sfxAct('hover', 'world', null); } }
  for (const it of PRESS.list) {
    const p = it.rec.press;
    if (p.do) {
      for (const st of [prMap(it).get(it.id), PRESS.try.get(it.id)]) {
        if (!st) continue;
        for (let j = 0; j < p.do.length; j++) {
          const e = p.do[j];
          if (e.what !== 'show' && e.what !== 'hide') continue;
          const src = prSrc(it, (st === PRESS.try.get(it.id) ? 't' : 'd') + j, st.at, e.fade === 'cut'), M = e.what === 'show' ? S : H;
          if (enteredLater(src, M.get(e.on))) M.set(e.on, src);
        }
      }
    }
    const h = p.hover && PRESS.hv.get(it.id);
    if (h && (!h.off || Tr - h.off < PLAY_EDGE)) {
      for (let j = 0; j < p.hover.length; j++) {
        const e = p.hover[j];
        if (e.what !== 'show' && e.what !== 'hide') continue;
        const src = prSrc(it, 'h' + j, h.at, e.fade === 'cut'), M = e.what === 'show' ? S : H;
        if (enteredLater(src, M.get(e.on))) M.set(e.on, src);
      }
    }
  }
}
// the runs a press starts (its stamp: n, at in room ms): once, stop and seq start at its moment; a loop toggles by n's parity
// (odd starts it, even stops the run this entry started); a seq entry only on the presser's device (it writes qr, the others
// see it through that); show and hide are sources (pressShowHide)
function pressDo(it, list, st, mine, tag) {
  const T = roomToRun(st.at);
  list.forEach((e, i) => {
    if (!prRun(e.what)) return;
    const t = STU.items.get(e.on);
    if (!t || !PLAY_KINDS[e.what].includes(t.kind)) return;
    if (e.what === 'seq' && (!mine || tag === 't')) return;   // (a sequence is shared: only the presser writes it, never a Try)
    const x = { c: it, e, ek: it.id + '|' + tag + i + '|' + st.n, src: 'press' };
    if (e.how === 'loop') {
      const R = t.tr && t.tr[e.what];
      if (st.n % 2 === 1) trgStart(x, T, false);
      else if (R && !R.off && R.src === 'press' && R.c === it && R.e.on === e.on) trgOff(R, T, 'press');
      else if (e.what === 'seq') seqCmd(e.on, 'stop', st.at, 'press');   // (no run here, the sequence's own state is what stops)
    } else trgStart(x, T, false);
  });
}
// whether a run of a press or a hover still has its entry in its item's record (Undo, an edit): else it comes off
function prEntryOf(R) {
  const p = R.c && R.c.rec && R.c.rec.press;
  if (!p || STU.items.get(R.c.id) !== R.c) return false;
  return (R.src === 'press' ? p.do : p.hover || []).some(e => e.on === R.e.on && e.what === R.e.what && e.how === R.e.how);
}
// each frame after the sequences: a new stamp fires its entries (a late joiner's too, whatever its age: the runs work out
// where they are now); pointing begun fires its entries, 0.3 s after it ends its loops and holds come off; runs whose entry or
// item is gone come off
function pressStep(Tr) {
  pressRev();
  trgList();
  for (const it of PRESS.list) {
    const p = it.rec.press;
    if (!p.do) { it.pk = it.pkt = null; continue; }
    const mapped = prMap(it).get(it.id), tr = PRESS.try.get(it.id);
    for (const [st, key] of [[mapped, 'pk'], [tr, 'pkt']]) {
      if (!st) { it[key] = null; continue; }
      const pk = it[key];
      if (pk && pk.n === st.n && pk.at === st.at) continue;
      it[key] = { n: st.n, at: st.at };
      pressDo(it, p.do, st, key === 'pkt' || p.who === 'own' || PRESS.mine.get(it.id) === st.n, key === 'pkt' ? 't' : 'd');
    }
  }
  for (const [id, h] of [...PRESS.hv]) {
    const it = STU.items.get(id), p = it && it.rec.press;
    if (!p || !p.hover) { PRESS.hv.delete(id); continue; }
    if (!h.fired) {
      h.fired = true;
      p.hover.forEach((e, i) => {
        if (!prRun(e.what) || e.what === 'seq') return;   // (pointing is this device's own: it never writes a shared sequence)
        const t = STU.items.get(e.on);
        if (!t || !PLAY_KINDS[e.what].includes(t.kind)) return;
        trgStart({ c: it, e, ek: it.id + '|h' + i + '|' + h.at, src: 'hover' }, trgClock(), false);
      });
    }
    if (h.off && Tr - h.off >= PLAY_EDGE) {
      for (const t of [...TRG.on]) for (const k of PLAY_WHAT) {
        const R = t.tr && t.tr[k];
        if (R && !R.off && R.src === 'hover' && R.c === it && (R.e.how === 'loop' || R.e.how === 'hold')) trgOff(R, trgClock(), 'unpointed');
      }
      PRESS.hv.delete(id);
    }
  }
  for (const t of [...TRG.on]) for (const k of PLAY_WHAT) {
    const R = t.tr && t.tr[k];
    if (R && !R.off && (R.src === 'press' || R.src === 'hover') && (R.e.how === 'loop' || R.e.how === 'hold') && !prEntryOf(R)) trgOff(R, trgClock(), 'removed');
  }
}
// Reset what I have seen and the lobby: this device's own stamps and tries forgotten, each item fires its shared stamp again
// next frame as a late joiner does
function pressReset() {
  STU.prOwn.clear(); PRESS.mine.clear(); PRESS.try.clear(); PRESS.hv.clear(); PRESS.tryHov = null;
  for (const it of STU.items.values()) it.pk = it.pkt = null;
}

// ------------------------------------------------------------------ copies --
// an item's copy (Duplicate): the copy's own entries that name the original name the copy; every item's entries naming the
// original gain one for the copy beside it (the original's too: pressing it acts on its copy as well)
function pressCopy(from, to) {
  const cp = STU.items.get(to);
  for (const it of [...STU.items.values()]) {
    const p = it.rec.press;
    if (!p || !PRESS_KINDS.includes(it.kind)) continue;
    const ren = e => (e.on === from ? Object.assign({}, e, { on: to }) : e);
    if (it === cp) { setRec(it.id, { press: pressBuild(p, { do: p.do && p.do.map(ren), hover: p.hover && p.hover.map(ren) }) }); continue; }
    if (!prEntries(p).some(e => e.on === from)) continue;
    setRec(it.id, { press: pressBuild(p, { do: p.do && withCopies(p.do, e => (e.on === from ? to : ''), PRESS_MAX), hover: p.hover && withCopies(p.hover, e => (e.on === from ? to : ''), PRESS_MAX) }) });
  }
}
// items deleted (in a change): the entries naming them go from every other item's press
function pressDeleted(gone) {
  for (const it of [...STU.items.values()]) {
    const p = it.rec.press;
    if (!p || gone.has(it.id) || !prEntries(p).some(e => gone.has(e.on))) continue;
    setRec(it.id, { press: pressBuild(p, { do: p.do && p.do.filter(e => !gone.has(e.on)), hover: p.hover && p.hover.filter(e => !gone.has(e.on)) }) });
  }
}
// a press as a record keeps it: the lists given (an empty one gone), who kept; undefined when nothing is left
function pressBuild(p, patch) {
  const d = 'do' in patch ? patch.do : p.do, h = 'hover' in patch ? patch.hover : p.hover, who = 'who' in patch ? patch.who : p.who, sn = 'send' in patch ? patch.send : p.send;
  if (!(d && d.length) && !(h && h.length) && !(sn && sn.length)) return undefined;
  const r = {};
  if (d && d.length) r.do = d;
  if (h && h.length) r.hover = h;
  if (sn && sn.length) r.send = sn;   // (its sends: e6u_send.js)
  if (who === 'own') r.who = 'own';
  return r;
}
const pressSet = (it, patch) => setRec(it.id, { press: pressBuild(it.rec.press || {}, patch) });

// -------------------------------------------------------------------- the card --
const PR_HOWS = { clip: ['once', 'loop', 'stop'], path: ['once', 'loop', 'stop'], sound: ['once', 'loop', 'stop'], motion: ['once', 'loop', 'stop'], seq: ['once', 'loop', 'stop'] };
const prHows = (list, what) => (list === 'hover' && (what === 'clip' || what === 'path') ? ['once', 'loop', 'hold', 'stop'] : PR_HOWS[what] || []);
const prHowWord = (list, what, h) => (what === 'seq' ? (h === 'stop' ? 'Stop it' : h === 'loop' ? (list === 'hover' ? 'Loop it' : 'Toggle it') : 'Start it') : h === 'loop' && list === 'do' ? 'Loop (toggles)' : HOW_WORD[h]);
// what can be done to an item by a reaction: its run kinds, show and hide, starting a sequence (never a picture)
const prOpts = t => seqOpts(t).filter(o => o.what !== 'tex' && o.what !== 'press' && o.what !== 'send');   // (a press and its sends are a sequence's events only: v158)
function prWords(e, list) {
  const t = STU.items.get(e.on), nm = t ? t.rec.name : 'an item not in the scene', hv = list === 'hover', cut = e.fade === 'cut' ? ' (at once)' : '';
  let w;
  if (e.what === 'show' || e.what === 'hide') w = (t && t.kind === 'c' ? (e.what === 'show' ? 'switches on' : 'switches off') : e.what === 'show' ? 'shows' : 'hides') + (hv ? ' while pointed at' : '') + (t && t.kind === 'c' ? '' : cut);   // (a cube: switched, v154)
  else if (e.what === 'seq') w = e.how === 'stop' ? 'stops the sequence' : e.how === 'loop' ? (hv ? 'loops the sequence while pointed at' : 'loops the sequence, pressed again stops') : 'starts the sequence';
  else {
    const what = e.what === 'clip' ? e.clip || 'its animation' : e.what === 'sound' ? 'the sound' : e.what === 'path' ? 'its recorded path' : 'its motion';
    w = e.how === 'stop' ? 'stops ' + (e.what === 'clip' ? 'its animation' : e.what === 'sound' ? 'the sound' : what)
      : `${what} · ` + (e.how === 'once' ? 'once' : e.how === 'loop' ? (hv ? 'loops while pointed at' : 'loops, pressed again stops') : 'held while pointed at');
  }
  return `${nm} · ${w}`;
}
function prWhy(e) {
  const t = STU.items.get(e.on);
  if (!t || !prKinds(e.what).includes(t.kind)) return 'It names an item not in the scene (or one this cannot be done to).';
  if (SEQ_RUN.includes(e.what)) return playWhy(e);
  return '';
}
function prSentence(P) {
  const t = STU.items.get(P.on);
  if (!t || !P.what) return 'Pick what it does.';
  const nm = t.rec.name, hv = P.list === 'hover', lead = hv ? 'While pointed at' : 'When pressed', h = P.how;
  if (t.kind === 'c' && (P.what === 'show' || P.what === 'hide')) return `${lead}, the cube ${nm} is switched ${P.what === 'show' ? 'on' : 'off'}${hv ? '' : ' until something switches it again'}.`;   // (v154)
  if (P.what === 'show') return `${lead}, ${nm} shows${P.fade === 'cut' ? ' at once' : ' (fades in)'}.`;
  if (P.what === 'hide') return `${lead}, ${nm} hides${P.fade === 'cut' ? ' at once' : ' (fades out)'}.`;
  if (P.what === 'seq') return h === 'stop' ? `${lead}, ${nm} stops.` : h === 'loop' ? `${lead}, ${nm} starts from its beginning${hv ? ', and stops when you point away' : '; pressed again, it stops'}.` : `${lead}, ${nm} starts from its beginning.`;
  const what = P.what === 'clip' ? P.clip : P.what === 'sound' ? 'the sound' : P.what === 'path' ? 'its recorded path' : 'its motion', as = hv ? 'As you point at it' : 'When pressed';
  if (h === 'stop') return `${as}, what runs on ${nm} stops.`;
  if (h === 'once') return `${as}, ${nm} plays ${what} once from its start.`;
  if (h === 'loop') return `${as}, ${nm} plays ${what} again and again` + (hv ? ', until you point away.' : '; pressed again, it stops.');
  return `${as}, ${nm} plays ${what} to its end and holds there, until you point away.`;
}
const prDraft = P => {
  const e = { on: P.on, what: P.what };
  if (P.what === 'show' || P.what === 'hide') { if (P.fade === 'cut') e.fade = 'cut'; return e; }
  if (P.what === 'clip' && P.how !== 'stop') e.clip = P.clip;
  e.how = P.how;
  return e;
};
const prNorm = (P) => normPressList([prDraft(P)], P.list)[0] || null;
const prKey = e => e.on + '|' + e.what;
const PR_PARA = 'A press works without editing, for anyone, a visitor too (a click on a page, the trigger in a headset). It is for everyone at this circle unless set to each person; a loop is toggled by each press. Pointing at it is each person\'s own and shared with nobody.';
function pressBlocks(it, B, dis) {
  const p = it.rec.press || {}, P = STU.prp && STU.prp.id === it.id ? STU.prp : null, own = p.who === 'own';
  const full = l => (p[l] || []).length >= PRESS_MAX;
  const sect = (list, title) => {
    const L = p[list] || [];
    B.push({ label: L.length ? `${title} (${L.length})` : title });
    if (!L.length) B.push({ p: list === 'do' ? 'Nothing happens when it is pressed.' : 'Nothing happens while it is pointed at.', c: 'faint' });
    L.forEach((e, k) => {
      const why = prWhy(e);
      B.push({ row: [{ id: `prf:${list}:${k}`, label: prWords(e, list), act: 'i:prFlash', v: e.on }, { id: `prx:${list}:${k}`, label: '✕', act: 'i:prDel', v: list + ':' + k, dis, col: 'red' }] });
      if (why) B.push({ p: why, c: 'amber' });
    });
    B.push({ row: [{ id: 'prpick:' + list, label: P && P.list === list ? 'Cancel' : 'Add a reaction...', act: 'i:prPick', v: list, on: !!(P && P.list === list), dis: dis || (!(P && P.list === list) && full(list)) }] });
    if (full(list)) B.push({ p: `${PRESS_MAX} reactions: the most one list takes.`, c: 'amber' });
  };
  sect('do', 'When pressed');
  B.push({ label: 'Pressed by', row: [{ id: 'prwho:all', label: 'Everyone here', act: 'i:prWho', v: 'all', on: !own, dis }, { id: 'prwho:own', label: 'Each person', act: 'i:prWho', v: 'own', on: own, dis }] });
  sect('hover', 'While pointed at');
  B.push({ p: 'Pointing is always each person\'s own: nobody else sees what you point at react.', c: 'faint' });
  if (P && P.step === 'obj') {
    B.push({ p: (XR.on ? 'Point at it and pull the trigger' : 'Click it in the scene, or pick it here') + ': the item the reaction acts on (this item, another, a cube to switch on or off, or a sequence).', c: 'amber' });
    const cands = [it].concat([...STU.items.values()].filter(t => t.id !== it.id && prOpts(t).length)).filter(t => prOpts(t).length);
    sqPaged(B, `Items (${cands.length})`, cands.map(t => ({ id: 'pron:' + t.id, label: t.id === it.id ? 'This item' : t.rec.name, sub: t.id === it.id ? t.rec.name : KIND_NAME[t.kind], act: 'i:prOn', v: t.id, dis })), P.page, 'prPg');
  } else if (P) {
    const t = STU.items.get(P.on), opts = t ? prOpts(t) : [];
    B.push({ kv: [['Acts on', t ? `${t.id === it.id ? 'This item' : t.rec.name} · ${KIND_NAME[t.kind]}` : 'not in the scene']] }, { row: [{ id: 'prback', label: 'Another item...', act: 'i:prBack', dis }] });
    const clips = opts.filter(o => o.what === 'clip'), others = opts.filter(o => o.what !== 'clip');
    if (t && t.kind === 'o' && !t.model) B.push({ p: `${t.rec.name}'s model is not here yet: its animations show once it is.`, c: 'faint' });
    if (clips.length) sqPaged(B, `Its animations (${clips.length})`, clips.map(o => ({ id: 'prwhat:clip:' + o.clip, label: o.clip, sub: o.sub, act: 'i:prWhat', v: 'clip:' + o.clip, on: P.what === 'clip' && P.clip === o.clip, dis })), P.cpage, 'prCPg');
    if (others.length) B.push({ label: clips.length ? 'Or' : 'What', row: others.map(o => ({ id: 'prwhat:' + o.what, label: o.label, act: 'i:prWhat', v: o.what, on: P.what === o.what, dis })) });
    if (!opts.length) B.push({ p: 'Nothing to do to it now.', c: 'amber' });
    else if (P.what) {
      if (P.what === 'show' || P.what === 'hide') { if (!(t && t.kind === 'c')) B.push({ label: 'How', row: [{ id: 'prfade:fade', label: 'Fade', act: 'i:prFade', v: '', on: P.fade !== 'cut', dis }, { id: 'prfade:cut', label: 'At once', act: 'i:prFade', v: 'cut', on: P.fade === 'cut', dis }] }); }   // (a cube switches at once: no fade, v154)
      else B.push({ label: 'How', row: prHows(P.list, P.what).map(h => ({ id: 'prhow:' + h, label: prHowWord(P.list, P.what, h), act: 'i:prHow', v: h, on: P.how === h, dis })) });
      B.push({ kv: [['It will', prSentence(P)]] });
      const d = prNorm(P), same = !!d && (p[P.list] || []).some(e => prKey(e) === prKey(d));
      B.push({ row: [{ id: 'pradd', label: same ? 'Replace' : 'Add', act: 'i:prAdd', primary: true, dis: dis || !d || (!same && full(P.list)) }] });
    }
  }
  B.push({ label: 'Try (this device only)', row: [{ id: 'prtry', label: 'Try press', act: 'i:prTry', dis: !(p.do && p.do.length) }, { id: 'prtryh', label: 'Try pointing', act: 'i:prTryHover', dis: !(p.hover && p.hover.length) }] });
  B.push({ p: PR_PARA, c: 'faint' });
}
Object.assign(ITEM_ACT, {
  prPick: (it, list) => {
    if (!PRESS_KINDS.includes(it.kind) || (list !== 'do' && list !== 'hover')) return;
    STU.prp = STU.prp && STU.prp.id === it.id && STU.prp.list === list ? null : { id: it.id, list, step: 'obj', on: '', what: '', clip: '', how: 'once', fade: '', page: 0, cpage: 0 };
    STU.pick = null; STU.txp = null; STU.plp = null;
  },
  prOn: (it, id) => {
    const P = STU.prp, t = STU.items.get(id);
    if (!P || P.id !== it.id || !t) return;
    const o = prOpts(t);
    if (!o.length) return;
    const f = o[0];
    Object.assign(P, { step: 'how', on: id, what: f.what, clip: f.clip || '', page: 0, cpage: 0, how: 'once', fade: '' });
  },
  prBack: it => { if (STU.prp && STU.prp.id === it.id) Object.assign(STU.prp, { step: 'obj', on: '', what: '', clip: '' }); },
  prWhat: (it, v) => {
    const P = STU.prp, t = P && P.id === it.id ? STU.items.get(P.on) : null;
    if (!t) return;
    const s = String(v), what = s.startsWith('clip:') ? 'clip' : s, clip = what === 'clip' ? s.slice(5) : '';
    if (!prOpts(t).some(o => o.what === what && (what !== 'clip' || o.clip === clip))) return;
    P.what = what; P.clip = clip;
    if (what !== 'show' && what !== 'hide' && !prHows(P.list, what).includes(P.how)) P.how = 'once';
  },
  prHow: (it, v) => { const P = STU.prp; if (P && P.id === it.id && prHows(P.list, P.what).includes(v)) P.how = v; },
  prFade: (it, v) => { const P = STU.prp; if (P && P.id === it.id) P.fade = v === 'cut' ? 'cut' : ''; },
  prPg: (it, d) => { const P = STU.prp; if (P) P.page = Math.max(0, P.page + (+d || 0)); },
  prCPg: (it, d) => { const P = STU.prp; if (P) P.cpage = Math.max(0, P.cpage + (+d || 0)); },
  prFlash: (it, id) => { STU.flash = STU.items.has(id) ? { id, at: performance.now(), play: true } : null; },
  prAdd: it => {
    const P = STU.prp;
    if (!PRESS_KINDS.includes(it.kind) || !P || P.id !== it.id || P.step !== 'how' || !P.what) return;
    const d = prNorm(P);
    if (!d) return;
    const L = ((it.rec.press || {})[P.list] || []).slice(), i = L.findIndex(e => prKey(e) === prKey(d));
    if (i >= 0) L[i] = d; else if (L.length >= PRESS_MAX) return; else L.push(d);
    pressSet(it, { [P.list]: L });
    STU.prp = null;
  },
  prDel: (it, v) => {
    const [list, k] = String(v).split(':'), L = ((it.rec.press || {})[list] || []).slice();
    if ((list !== 'do' && list !== 'hover') || !(+k >= 0 && +k < L.length)) return;
    L.splice(+k, 1);
    pressSet(it, { [list]: L });
  },
  prWho: (it, v) => { if (it.rec.press && (v === 'own') !== (it.rec.press.who === 'own')) pressSet(it, { who: v === 'own' ? 'own' : undefined }); },
  prTry: it => pressTry(it),
  prTryHover: it => pressTryHover(it),
});
PANE_ONLY.push('prPick', 'prOn', 'prBack', 'prWhat', 'prHow', 'prFade', 'prPg', 'prCPg', 'prFlash', 'prTry', 'prTryHover');
// the card's signature part: the pick and what is pressed here
function pressSig() {
  const it = STU.items.get(STU.sel);
  if (!it || !PRESS_KINDS.includes(it.kind)) return '';
  const P = STU.prp && STU.prp.id === it.id ? STU.prp : null;
  return [it.rec.press ? 1 : 0, P ? [P.list, P.step, P.on, P.what, P.clip, P.how, P.fade, P.page, P.cpage].join('|') : ''].join(':');
}

// ------------------------------------------------------------------ for tests --
// an item's press: its record, the stamp (the room's or its own), what this device has seen, whether it can be pressed and is
// pointed at, the show and hide sources it gives now and the runs it started
function pressState(id) {
  const it = STU.items.get(id);
  if (!it) return null;
  const p = it.rec.press || null, st = p ? prMap(it).get(id) || null : null, Tr = behNow(), sources = [], runs = [];
  if (p) {
    for (const s of [st, PRESS.try.get(id)]) if (s && p.do) for (const e of p.do) if (e.what === 'show' || e.what === 'hide') sources.push({ on: e.on, kind: e.what, since: s.at, from: 'press', cut: e.fade === 'cut' });
    const h = PRESS.hv.get(id);
    if (h && p.hover && (!h.off || Tr - h.off < PLAY_EDGE)) for (const e of p.hover) if (e.what === 'show' || e.what === 'hide') sources.push({ on: e.on, kind: e.what, since: h.at, from: 'hover', cut: e.fade === 'cut' });
  }
  for (const t of TRG.on) for (const k of PLAY_WHAT) { const R = t.tr && t.tr[k]; if (R && R.c === it) runs.push([t.id, k, R.e.clip || '', R.e.how, R.src, R.at, R.off]); }
  return { press: p, stamp: st, seen: it.pk || null, pressable: pressable(it), hover: PRESS.hv.has(id) && hoverNow() === id, pointed: hoverNow() === id, sources, runs, mine: PRESS.mine.get(id) || 0, log: PRESS.log.slice() };
}

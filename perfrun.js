// The performance run (HOST.perfRun, v228; the owner, 28 November 2026: "A performance test run for running directly on the
// headsets, plays all stories and some studio scenes in order (that can maybe reuse the repeat all code) and records
// metrics, great if it can run fully autonomous but maybe two parts, one interactive on the headset, one that just runs
// through all the stories and a studio scene on the headsets?"). docs/agents/shell.md, "The performance run".
// Two parts, both on a page as well as in a headset:
// - the run-through (part 'run'): every story of both sets of cards (HOST.stories(), the Stories screen's order), then studio
//   scenes (the examples that ship with the app, and the first of a relay's scenes); per story its load, each chapter
//   seeked to and played for a while, then explore mode (each tab a while). Once a headset session runs, it runs alone;
//   a page runs it at once.
// - the hands-on part (part 'hands'): one instruction card at a time (the panel, the menu, the grip, the sticks, walking and
//   looking about, AR occlusion on and off, the Stories screen, a studio example), each with Done and Skip.
// Each segment (a load, a chapter, a tab, a scene, a step) is measured from the story's frames (HOST.loading.wrap calls
// frame()), and kept as a result on this device (localStorage perfRunLast), sent to the relay as events of the developer
// notebook's run log when developer mode is on (notes.js runEvent: 'perfrun', 'seg', 'perfend'; v231 the errors and
// warnings caught, 'err', 'errn', 'errcap'), and offered as JSON on a
// page. node tools/notes/notes.mjs perfrun <id|file> [<id|file>] turns one or two into Markdown. Progress is kept in
// localStorage (perfRun) so a reload picks the run up. Nothing here is a room's, a story's state or a stored setting: the
// settings it changes (automatic quality pinned off on request, occlusion in the hands-on AR steps, the studio's last
// scene) are put back at the end and on a stop, and on the next load after a crash. Never in a shared room.
// (loaded on demand, HOST.mods: run with HOST.quiet set, so its listeners and timers are the shell's)
HOST.perfRun = (HOST.quietly || (fn => fn()))(function () {
  'use strict';
  const KEY = 'perfRun', LAST = 'perfRunLast', V = 1;
  // the defaults (seconds): ch a chapter's sample, settle after a seek (not measured), ex a tab of explore mode, tabs at
  // most so many tabs, load the frames measured after a story's first, scene a studio scene, hand a hands-on step at most
  const DEF = { ch: 20, settle: 1, ex: 5, tabs: 4, load: 3, scene: 20, hand: 45, full: false, aq: 'keep', hud: true, scenes: 'default', stories: null, chapters: 0, hands: null, story: 'ppicell', handScene: 'bliss-xp', examples: 'examples', relayScenes: 1, hz: 0 };
  const LIMIT = { story: 90, scene: 75, maxAge: 6 * 3600 * 1000 };
  const HANDS = [
    { id: 'panel', title: 'The story panel', say: 'Point at the story\'s panel and press through its tabs, one after another.' },
    { id: 'menu', title: 'The menu', say: 'Click a stick to open the menu, then go through each of its tabs.', btn: 'Open the menu' },
    { id: 'grip', title: 'Grip and move', say: 'Hold a grip button and move the scene about. Let go and do it again.' },
    { id: 'sticks', title: 'Moving with the sticks', say: 'Push the left stick to move and the right one to turn. (Moving with the sticks must be on: the menu\'s Settings.)' },
    { id: 'walk', title: 'Walk and look about', say: 'Walk round the scene. Look left and right, up and down, quickly.' },
    { id: 'occlon', title: 'Occlusion on', say: 'Real-world occlusion is on. Hold your hands into the scene and walk close to furniture.', ar: true, occl: 'both' },
    { id: 'occloff', title: 'Occlusion off', say: 'Real-world occlusion is off now. Do the same again.', ar: true, occl: 'off' },
    { id: 'arch', title: 'The Stories screen', say: 'The Stories screen is open with all its cards. Look along it and point at a few cards.' },
    { id: 'studio', title: 'A studio scene', say: 'A studio example scene. Walk through it and look about.', scene: 'bliss-xp' },
  ];
  const G = (fn, d) => { try { const v = fn(); return v === undefined ? d : v; } catch (e) { return d; } };
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const put = (k, v) => { try { if (v === null || v === undefined) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* storage blocked or full */ } };
  const now = () => performance.now();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const r1 = v => (v == null || !isFinite(v) ? null : Math.round(v * 10) / 10);
  const r2 = v => (v == null || !isFinite(v) ? null : Math.round(v * 100) / 100);
  const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const KEYRE = /^[a-z][a-z0-9-]{0,31}$/, NAMERE = /^[\w .-]{1,80}$/;
  const STOP = { stop: true }, PAUSE = { pause: true }, CUT = 'the headset view ended';
  const NOTFAIL = ['skipped', 'only in AR', 'stopped', CUT];
  const notice = (t, x, ms) => { try { const L = HOST.notesLink; if (L && L.notice) L.notice(t, x, ms); } catch (e) { /* no notice */ } };
  const app = () => G(() => HOST.cur.collab.APP, null);
  const xrNow = () => (HOST.session ? (/ar/i.test(HOST.mode || '') && !/vr/i.test(HOST.mode || '') ? 'ar' : 'vr') : '');
  const title = k => G(() => HOST.meta(k).title, k) || k;

  // ------------------------------------------------------------------ state --
  // R: the run. on: running (the loop alive); part 'run' or 'hands'; want: a start waiting for a headset session (its
  // part and options); plan: the items (story, scene or hand step), i the next; segs: the measured segments; saved: the
  // raw settings to put back; seg: the segment being measured; card: what the card shows; hud: the read-out's line
  const R = { on: false, part: '', want: null, id: '', opts: null, plan: [], i: 0, cur: -1, segs: [], info: null, saved: null, at: 0, xr: '', t0: 0,
    seg: null, lastT: 0, firstFor: '', firstAt: 0, card: null, cardN: 0, hud: '', hudOff: false, sig: 0, done: null, handsAns: '', paused: '', resumeP: null, resumeFn: null,
    errN: 0, errs: [], emap: [], ecut: 0, ecap: false, qlog: [], q: undefined, lost: 0, logOwn: false, rel: '', batt0: null, quietUntil: 0, stopWhy: '', cardFn: null, hz: 0, hzHow: '', ending: false, endP: null, stopW: [], set0: 0 };
  const T = { tick: 200 };   // (tests)
  const REC = { seg: null, lastT: 0, errOn: false };   // (the bench's recorder, below: rec)
  let lastSum = null;   // (line(): the last result's line)
  const bump = () => { R.sig++; paint(); };
  const XRS = { vr: false, ar: false };
  try {
    if (navigator.xr && navigator.xr.isSessionSupported) {
      Promise.all(['immersive-vr', 'immersive-ar'].map(m => navigator.xr.isSessionSupported(m).catch(() => false))).then(([v, a]) => {
        XRS.vr = !!v; XRS.ar = !!a;
        if (R.want && !R.on && R.cardFn && R.card && !R.want.resume) R.cardFn();
      });
    }
  } catch (e) { /* no WebXR */ }
  // the release this page runs (the shell's: index.html HOST.shell); version.json's (the server's latest) kept beside it
  const shellRel = () => G(() => (HOST.shell && HOST.shell.n ? 'networks-v' + HOST.shell.n : ''), '');
  const REL = fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).then(v => { if (v && typeof v.version === 'string') R.rel = v.version; }).catch(() => {});

  // the options: from a start call or the address (#perfrun or #handson with pr... keys: docs/agents/shell.md)
  function opts(o) {
    const O = Object.assign({}, DEF);
    for (const k of Object.keys(DEF)) if (o && o[k] !== undefined) O[k] = o[k];
    for (const k of ['ch', 'settle', 'ex', 'tabs', 'load', 'scene', 'hand', 'chapters', 'relayScenes', 'hz']) { const v = +O[k]; O[k] = isFinite(v) && v >= 0 ? Math.min(v, 3600) : DEF[k]; }
    O.full = !!O.full && O.full !== 'off'; O.hud = O.hud !== false && O.hud !== 'off';
    O.aq = O.aq === 'off' ? 'off' : 'keep';
    const list = v => (Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(/[,\s]+/) : null);
    O.stories = list(O.stories); if (O.stories) O.stories = O.stories.filter(k => KEYRE.test(k));
    O.hands = list(O.hands); if (O.hands) O.hands = O.hands.filter(k => HANDS.some(h => h.id === k));
    if (!KEYRE.test(String(O.story))) O.story = DEF.story;
    if (!NAMERE.test(String(O.handScene))) O.handScene = DEF.handScene;
    if (!/^[\w./-]{1,80}$/.test(String(O.examples)) || /\.\.|\/\//.test(O.examples)) O.examples = DEF.examples;
    if (Array.isArray(O.scenes)) O.scenes = O.scenes.join(',');
    O.scenes = String(O.scenes || 'default');
    return O;
  }
  function fromHash(hp) {
    const o = {}, m = { prstories: 'stories', prch: 'ch', prex: 'ex', prtabs: 'tabs', prscenes: 'scenes', praq: 'aq', prhud: 'hud', prstory: 'story', prhands: 'hands', prchapters: 'chapters', prexamples: 'examples', prscene: 'scene', prhandscene: 'handScene', prload: 'load', prsettle: 'settle', prhand: 'hand', prhz: 'hz' };
    for (const [k, n] of Object.entries(m)) if (hp.has(k)) o[n] = hp.get(k);
    if (hp.has('prfull')) o.full = hp.get('prfull') !== 'off';
    return o;
  }

  // ------------------------------------------------------------------ progress, kept across a reload --
  function save() {
    if (!R.on && !R.paused) return;
    const s = { v: V, id: R.id, part: R.part, opts: R.opts, plan: R.plan, i: R.i, cur: R.cur, segs: R.segs, info: R.info, saved: R.saved, at: R.at, xr: R.xr, errs: R.errs.slice(-30), errN: R.errN, emap: R.emap, ecut: R.ecut, ecap: R.ecap, qlog: R.qlog.slice(-60), batt0: R.batt0, logOwn: R.logOwn, rel: shellRel(), hz: R.hz, hzHow: R.hzHow };
    let j = JSON.stringify(s);
    if (j.length > 1500000) { s.qlog = []; s.errs = s.errs.slice(-5); j = JSON.stringify(s); }
    put(KEY, j);
  }
  function loadSaved() { try { const s = JSON.parse(get(KEY) || 'null'); return s && s.v === V && Array.isArray(s.plan) && Array.isArray(s.segs) ? s : null; } catch (e) { return null; } }

  // ------------------------------------------------------------------ settings: changed for the run, put back after --
  // (raw localStorage values first, so what was there is what comes back, even a key that was never set)
  const RAW = ['xrAuto', 'xrOccl'];
  function snapshot() {
    const s = { raw: {}, auto: G(() => HOST.xr.auto(), null), occl: G(() => HOST.occlusion.own(), null), studio: {} };
    for (const k of RAW) s.raw[k] = get(k);
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^studioLast\./.test(k)) s.studio[k] = localStorage.getItem(k); } } catch (e) { /* storage blocked */ }
    return s;
  }
  function restore() {
    const s = R.saved;
    if (!s) return;
    try { if (s.auto !== null && HOST.xr.setAuto && HOST.xr.auto() !== s.auto) HOST.xr.setAuto(s.auto); } catch (e) { /* no automatic quality */ }
    try { if (s.occl && HOST.occlusion && HOST.occlusion.own() !== s.occl) HOST.occlusion.set(s.occl); } catch (e) { /* no occlusion */ }
    for (const k of RAW) put(k, s.raw[k]);
    try {
      const gone = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^studioLast\./.test(k) && !(k in s.studio)) gone.push(k); }
      for (const k of gone) localStorage.removeItem(k);
      for (const [k, v] of Object.entries(s.studio)) localStorage.setItem(k, v);
    } catch (e) { /* storage blocked */ }
    R.saved = null;
  }
  function pin() { if (R.opts && R.opts.aq === 'off' && HOST.xr.setAuto && HOST.xr.auto()) HOST.xr.setAuto(false); }

  // ------------------------------------------------------------------ errors and the WebGL context, caught while running --
  // (v231) Each distinct message goes into the run log as it first comes ('err': i its number, at the seconds into the run,
  // seg the segment or '' between segments, lvl 'error' or 'warn', story, msg); the same message again is only counted, and
  // the counts go as 'errn' { i, n } as the run ends. At most ERRMAX distinct messages are sent a run ('errcap' once when the
  // cap is hit; the rest are counted, perfend errcut). R.emap: the distinct messages, kept with the run's progress and in the
  // result (errlist). A message never holds an address's query or hash (where a room's code, a password or a name would
  // sit), a Bearer token or a relay password this device keeps (tools/notes/SPEC.md, "Run logs")
  const CON = { error: console.error, warn: console.warn }, ERRMAX = 60, ERRLEN = 180;
  const relayToks = () => G(() => { const o = JSON.parse(get('relayTokens') || '{}'); return Object.values(o && typeof o === 'object' ? o : {}).filter(t => typeof t === 'string' && t.length >= 3); }, []);
  function cleanMsg(s) {
    s = String(s)
      .replace(/\b([a-z][a-z0-9+.-]*:\/\/[^\s?#'"`<>()[\]{}]*)[?#][^\s'"`<>()[\]{}]*/gi, '$1')   // (an address: its query and hash go)
      .replace(/(^|[\s'"`(=:])([^\s'"`()?#]*)[?#](?=[\w%.-]+=)[^\s'"`<>()]*/g, '$1$2')   // (any other word's query or hash: /rooms/A?name=B, host/x#s=XYZ, ?s=XYZ)
      .replace(/\b(Bearer|token|password|pw)(\s*[:=]?\s*)[^\s'"`,;)]+/gi, '$1$2…');
    for (const t of relayToks()) s = s.split(t).join('…');
    s = s.replace(/\s+/g, ' ').trim();
    return s.length > ERRLEN ? s.slice(0, ERRLEN - 1) + '…' : s;
  }
  const segLabel = () => (R.seg ? (R.seg.kind + ' ' + R.seg.story + ' ' + R.seg.key).trim() : '');
  function caught(kind, a) {
    if (!R.on && !REC.errOn) return;
    const raw = [].map.call(a, x => (x && x.stack ? String(x.message || x) : typeof x === 'object' ? G(() => JSON.stringify(x), String(x)) : String(x))).join(' ');
    if (REC.errOn) recCaught(kind, raw);
    if (!R.on) return;
    const msg = G(() => cleanMsg(raw), 'a message that could not be read'), at = Math.round((Date.now() - R.at) / 1000), seg = segLabel(), lvl = kind === 'error' ? 'error' : 'warn';
    R.errN++; if (R.seg) R.seg.errs++;
    if (R.errs.length < 100) R.errs.push({ at, seg, msg: kind + ': ' + msg });
    const k = lvl + ' ' + msg, e = R.emap.find(x => x.k === k);
    if (e) { e.n++; return; }
    if (R.emap.length >= ERRMAX) {
      R.ecut++;
      if (!R.ecap) { R.ecap = true; runEvent('errcap', { at, max: ERRMAX }); }
      return;
    }
    const x = { k, i: R.emap.length + 1, n: 1, at, seg, lvl, story: HOST.curKey || '', msg };
    R.emap.push(x);
    x.sent = errSend(x);
  }
  const errSend = x => runEvent('err', { i: x.i, at: x.at, seg: x.seg, lvl: x.lvl, story: x.story, msg: x.msg });
  const errList = () => R.emap.map(x => ({ i: x.i, n: x.n, at: x.at, seg: x.seg, lvl: x.lvl, story: x.story, msg: x.msg }));
  const errKept = list => (Array.isArray(list) ? list.filter(x => x && typeof x.msg === 'string').slice(0, ERRMAX).map(x => Object.assign({ k: (x.lvl || 'error') + ' ' + x.msg }, x)) : []);
  // the repeats' counts, sent once as the run ends
  function errCounts() { for (const x of R.emap) if (x.n > 1) runEvent('errn', { i: x.i, n: x.n }); }
  console.error = function (...a) { caught('error', a); return CON.error.apply(console, a); };
  console.warn = function (...a) { caught('warning', a); return CON.warn.apply(console, a); };
  document.addEventListener('visibilitychange', () => { R.lastT = 0; });   // (frame(): the interval across a hidden page is not counted)
  window.addEventListener('error', e => caught('error', [e.message || e.error || 'error']));
  window.addEventListener('unhandledrejection', e => caught('error', [e.reason || 'a promise was rejected']));
  { const cv = document.getElementById('gl'); if (cv) cv.addEventListener('webglcontextlost', () => { if (REC.seg) REC.seg.lost = true; if (!R.on) return; R.lost++; if (R.seg) R.seg.lost = true; caught('error', ['the WebGL context was lost']); }); }

  // ------------------------------------------------------------------ measuring --
  // a segment: its frames' intervals (ms, from the frame callback's time: the XR frame's in a session), the story's
  // frame counts from HOST.perf.last() (measured while a run is on: index.html HOST.perf), errors, quality changes
  const segMake = (kind, story, key, o) => Object.assign({ kind, story: story || '', key: String(key || ''), item: R.i, t0: now(), w0: Date.now(), dts: [], sum: 0, clk: 0, long: 0, calls: 0, tri: 0, js: 0, lines: 0, pts: 0, pn: 0, lfN: -1, errs: 0, lost: false, qch: 0, q0: aq(), why: '' }, o || {});
  function segOpen(kind, story, key, o) {
    segClose();
    R.seg = segMake(kind, story, key, o);
    R.lastT = 0;
    return R.seg;
  }
  // the display's rate: in a session the session's own (null when the headset does not say: the rate asked for is not
  // the rate got, so no refreshes are counted missed); on a page the option prhz, else found once before the run from the
  // page's own frames at rest (probe: the fastest tenth of a second's intervals, snapped to a common rate), else 60
  // assumed. Never from a segment's frames: a story drawing steadily at 30 on a 60 Hz screen would miss nothing
  const RATES = [30, 45, 48, 50, 60, 72, 75, 80, 90, 100, 120, 144, 165, 240];
  function rate() {
    if (HOST.session) { const g = G(() => HOST.xr.hzState().got, 0); return g ? Math.round(g) : null; }
    return R.hz || 60;
  }
  const rateHow = () => (HOST.session ? (rate() ? 'session' : 'unknown') : R.hzHow || 'assumed');
  async function probe() {
    if (R.opts && R.opts.hz > 0) { R.hz = Math.round(R.opts.hz); R.hzHow = 'option'; return; }
    const d = [];
    await new Promise(res => {
      const t0 = now(); let l = 0;
      const f = t => { if (l && t > l) d.push(t - l); l = t; if (d.length >= 60 || now() - t0 > 1500) res(); else requestAnimationFrame(f); };
      requestAnimationFrame(f); setTimeout(res, 2000);
    });
    if (d.length < 10) { R.hz = 60; R.hzHow = 'assumed'; return; }
    d.sort((a, b) => a - b);
    const f = 1000 / d[Math.floor(d.length * 0.1)];
    R.hz = RATES.reduce((b, h) => (Math.abs(h - f) < Math.abs(b - f) ? h : b), 60); R.hzHow = 'measured';
  }
  const aq = () => (HOST.session && HOST.xr && HOST.xr.aq ? G(() => { const q = HOST.xr.aq(); return String(q.level) + (q.low ? 'r' : ''); }, '') : '');
  const heap = () => G(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null), null);
  function segClose(why) {
    const S = R.seg;
    if (!S) return null;
    R.seg = null;
    const g = segStats(S, why);
    g.w = S.w0; g.item = S.item;
    R.segs.push(g);
    runEvent('seg', flat(g));
    save();
    return g;
  }
  // a segment's figures from its frames (the run's segments and the bench's, HOST.perfRun.rec)
  function segStats(S, why) {
    const d = S.dts.slice().sort((a, b) => a - b), n = d.length, q = p => (n ? d[Math.min(n - 1, Math.max(0, Math.ceil(n * p) - 1))] : null);
    const hz = rate(), P = hz ? 1000 / hz : 0;
    let miss = P ? 0 : null, stall = 0, run = 0;
    if (P) for (const x of S.dts) { miss += Math.max(0, Math.round(x / P) - 1); if (x > 1.5 * P) { run += x; if (run > stall) stall = run; } else run = 0; }
    const pn = S.pn;
    const g = {
      kind: S.kind, story: S.story, key: S.key, why: why || S.why || (S.lost ? 'the WebGL context was lost' : ''), dur: r1(S.sum / 1000), n,
      mean: n ? r2(S.sum / n) : null, p50: r2(q(0.5)), p95: r2(q(0.95)), p99: r2(q(0.99)), max: r2(n ? d[n - 1] : null), miss, stall: P ? r1(stall) : null, long: S.long, hz,
      calls: pn ? Math.round(S.calls / pn) : null, tri: pn ? Math.round(S.tri / pn) : null, js: pn ? r2(S.js / pn) : null, heap: heap(), q: aq(), qch: S.qch, errs: S.errs,
    };
    if (S.load !== undefined) g.load = S.load;
    if (S.build !== undefined) g.build = S.build;
    if (S.q0 !== g.q) g.q0 = S.q0;
    return g;
  }
  // a segment as a run log's event: at most 22 fields of numbers, strings, booleans or null (relay/notes.mjs); p50 is
  // left out for hz and long (the JSON result has every field)
  function flat(g) {
    const o = {};
    for (const k of ['kind', 'story', 'key', 'why', 'dur', 'n', 'mean', 'p95', 'p99', 'max', 'miss', 'stall', 'long', 'hz', 'calls', 'tri', 'js', 'heap', 'q', 'qch', 'errs', 'load']) {
      const v = g[k]; if (v === undefined) continue;
      o[k] = typeof v === 'string' ? v.slice(0, 200) : v;
    }
    return o;
  }
  function runEvent(ev, o) { try { return !!(HOST.notes && HOST.notes.runEvent && HOST.notes.runEvent(ev, o)); } catch (e) { return false; /* no run log */ } }
  // the frame hook (index.html HOST.loading.wrap, after the story's frame): never throws. Every interval counts, a stall
  // of a second or more too (long); only the first after a hidden view (the page hidden, the headset's view not visible:
  // taken off, its system menu) is dropped (R.lastT cleared: here, by the quarter-second timer and on visibilitychange)
  const hidden = () => !!(document.hidden || (HOST.session && HOST.session.visibilityState && HOST.session.visibilityState !== 'visible'));
  function frame(t) {
    if (!R.on && !REC.seg) return;
    if (hidden()) { R.lastT = 0; REC.lastT = 0; return; }
    const tt = Number.isFinite(t) && t > 0 ? t : now();
    if (R.on) {
      if (R.firstFor && !R.firstAt && HOST.curKey === R.firstFor && HOST.cur && G(() => HOST.loading.built(), false)) R.firstAt = now();
      feed(R.seg, R.lastT, tt);
      R.lastT = tt;
    }
    if (REC.seg) { feed(REC.seg, REC.lastT, tt); REC.lastT = tt; }
  }
  function feed(S, last, tt) {
    if (!S) return;
    if (last && tt > last) { const dt = tt - last; S.dts.push(dt); S.sum += dt; if (dt >= 1000) S.long++; else S.clk += dt; }
    const lf = HOST.perf && HOST.perf.last ? HOST.perf.last() : null;
    if (lf && lf.n !== S.lfN) { if (S.lfN >= 0) { S.calls += lf.calls; S.tri += lf.tri; S.js += lf.js; S.lines += lf.lines || 0; S.pts += lf.pts || 0; S.pn++; } S.lfN = lf.n; }
  }

  // ------------------------------------------------------------------ the recorder, for the headset bench (bench.js, v232) --
  // A segment measured as the run's are, while no run is on: open() starts it (one at a time), close() returns its figures
  // (perfrun's segment, kind 'bench', plus lines and pts a story frame, and errlist: the distinct messages caught while it
  // ran) and neither keeps it nor sends it to a run log. errors(true) catches errors and warnings for a job (each message
  // cleaned as the run's are, cleanMsg); errors(false) stops
  function recCaught(kind, raw) {
    const S = REC.seg;
    if (!S) return;
    S.errs++;
    const msg = G(() => cleanMsg(raw), 'a message that could not be read'), lvl = kind === 'error' ? 'error' : 'warn', k = lvl + ' ' + msg;
    const e = S.emap.find(x => x.k === k);
    if (e) e.n++; else if (S.emap.length < ERRMAX) S.emap.push({ k, n: 1, lvl, msg });
  }
  const rec = {
    open(kind, story, key) { REC.seg = segMake(kind || 'bench', story, key, { emap: [] }); REC.lastT = 0; return REC.seg; },
    close(why) {
      const S = REC.seg;
      if (!S) return null;
      REC.seg = null;
      const g = segStats(S, why);
      const pn = S.pn;
      g.lines = pn ? Math.round(S.lines / pn) : null; g.pts = pn ? Math.round(S.pts / pn) : null;
      g.errlist = S.emap.map(x => ({ n: x.n, lvl: x.lvl, msg: x.msg }));
      return g;
    },
    on: () => !!REC.seg,
    info: () => info(),
    errors(on) { REC.errOn = !!on; return { list: REC.seg ? REC.seg.emap.map(x => ({ n: x.n, lvl: x.lvl, msg: x.msg })) : [] }; },
  };

  // ------------------------------------------------------------------ waiting, with the stop, the pause and a watchdog --
  async function wait(fn, ms, why) {
    const t0 = now();
    for (;;) {
      if (!R.on) throw STOP;
      if (R.xr && !HOST.session) throw PAUSE;
      let v = false;
      try { v = fn(); } catch (e) { v = false; }
      if (v) return v;
      if (now() - t0 > ms) { if (why) throw new Error(why); return false; }
      await sleep(T.tick);
    }
  }
  // measured until the segment's frames add up to sec (frame time: its clock, the intervals under a second, so a long
  // stall is measured but does not use up the segment's time), or until done()
  // (stopped(): resolves as the run is stopped, for the waits that are not polls)
  const stopped = () => new Promise(r => R.stopW.push(r));
  const wake = () => { for (const f of R.stopW.splice(0)) f(); };
  async function measure(sec, done, guard) {
    const S = R.seg, lim = sec * 3000 + 30000, t0 = now();
    await wait(() => {
      if (guard) guard();
      if (S.clk >= sec * 1000) return true;
      if (done && done()) return true;
      if (now() - t0 > lim) { S.why = 'watchdog: frames stopped coming'; return true; }
      return false;
    }, Infinity);
  }
  async function idle() { await wait(() => !HOST.busy, 60000, 'the app stayed busy'); }

  // ------------------------------------------------------------------ the plan --
  async function plan(O) {
    const P = [];
    if (R.part === 'hands') {
      P.push({ kind: 'story', key: O.story, only: 'load' });
      for (const h of HANDS) if (!O.hands || O.hands.includes(h.id)) P.push({ kind: 'hand', id: h.id });
      return P;
    }
    const all = G(() => HOST.stories().map(m => m.key), []).filter(k => k !== 'hello');
    const keys = O.stories ? O.stories : all;
    for (const k of keys) P.push({ kind: 'story', key: k });
    for (const s of await scenes(O)) P.push(s);
    return P;
  }
  // studio scenes: 'default' (every example, and the first of a relay's scenes), 'examples', 'none', 'all' (every example and
  // up to three of the relay's), or names (an example's, or relay:<name>)
  async function scenes(O) {
    const w = O.scenes, out = [];
    if (w === 'none') return out;
    let ex = [];
    try { const j = await (await fetch(O.examples + '/index.json', { cache: 'no-store' })).json(); ex = (j && Array.isArray(j.scenes) ? j.scenes : []).map(s => s && s.name).filter(n => typeof n === 'string' && NAMERE.test(n)); } catch (e) { /* no examples here */ }
    let rel = [];
    if (w === 'default' || w === 'all' || /relay:/.test(w)) rel = await relayScenes();
    if (w === 'default' || w === 'examples' || w === 'all') {
      for (const n of ex) out.push({ kind: 'scene', name: n, src: 'examples' });
      if (w !== 'examples') for (const n of rel.slice(0, w === 'all' ? 3 : O.relayScenes)) out.push({ kind: 'scene', name: n, src: 'relay' });
      return out;
    }
    for (const n of w.split(/,/).map(s => s.trim()).filter(Boolean)) {
      if (n.startsWith('relay:')) { const m = n.slice(6); if (NAMERE.test(m)) out.push({ kind: 'scene', name: m, src: 'relay' }); }
      else if (NAMERE.test(n)) out.push({ kind: 'scene', name: n, src: 'examples' });
    }
    return out;
  }
  async function relayScenes() {
    try {
      const r = HOST.collab && HOST.collab.relayFind ? await HOST.collab.relayFind() : null;
      if (!r || !r.base) return [];
      const res = await fetch(String(r.base).replace(/\/+$/, '') + '/api/scenes', { cache: 'no-store', headers: r.token ? { Authorization: 'Bearer ' + r.token } : {} });
      if (!res.ok) return [];
      const j = await res.json();
      return (j && Array.isArray(j.scenes) ? j.scenes : []).map(s => s && s.name).filter(n => typeof n === 'string' && NAMERE.test(n));
    } catch (e) { return []; }
  }
  // about how long, in minutes (chapters guessed at 8 a story until it is loaded)
  function guess(P, O) {
    let s = 0;
    for (const it of P) s += it.kind === 'story' ? (it.only ? 15 : 10 + O.load + (O.chapters || 8) * ((O.full ? 45 : O.ch) + O.settle + 0.5) + Math.max(1, O.tabs) * O.ex) : it.kind === 'scene' ? 15 + O.scene : O.hand * 0.6;
    return Math.max(1, Math.round(s / 60));
  }

  // the same before the plan is made (its scenes guessed at five): for the start card
  function about(o) {
    const O = opts(o), n = O.stories ? O.stories.length : G(() => HOST.stories().filter(m => m.key !== 'hello').length, 20);
    return guess(Array.from({ length: n }, () => ({ kind: 'story' })).concat(O.scenes === 'none' ? [] : Array.from({ length: 5 }, () => ({ kind: 'scene' }))), O);
  }
  // the hands-on test's the same way: its story's load, then its steps (v230: the Experiments set's card says it too)
  function aboutHands(o) {
    const O = opts(o);
    return guess([{ kind: 'story', only: 'load' }].concat(HANDS.filter(h => !O.hands || O.hands.includes(h.id)).map(() => ({ kind: 'hand' }))), O);
  }

  // ------------------------------------------------------------------ the items --
  // a story's Stories screen (in a headset) out of the way: the story itself shows
  const showStory = () => G(() => HOST.cur.peek("typeof XR !== 'undefined' && XR.on && XR.stories ? (XR.stories = false, XR.inStory = true, 1) : 0"), 0);
  async function openStory(key, hash) {
    await idle();
    const t0 = now();
    R.firstFor = key; R.firstAt = 0;
    const was = HOST.curKey === key && HOST.cur;
    if (!was) {
      await Promise.race([HOST.start(key, hash), sleep(LIMIT.story * 1000), stopped()]);
      if (!R.on) throw STOP;
      if (HOST.curKey !== key || !HOST.cur) {
        const line = G(() => document.getElementById('ldLine').textContent, '') || '';
        throw new Error(HOST.busy ? 'did not load within ' + LIMIT.story + ' s' : 'did not start' + (line ? ': ' + line.slice(0, 160) : ''));
      }
    }
    await wait(() => R.firstAt, LIMIT.story * 1000, 'no first frame within ' + LIMIT.story + ' s');
    showStory();
    const build = G(() => { const m = HOST.cur.peek('typeof LOAD !== "undefined" ? LOAD.ms : null'); return m && typeof m === 'object' ? Math.round(Object.values(m).reduce((a, b) => a + (Array.isArray(b) ? +b[1] || 0 : +b || 0), 0)) : null; }, null);   // (LOAD.ms: [label, ms] for each step)
    return { load: was ? null : Math.round(R.firstAt - t0), build, was: !!was };
  }
  async function runStory(it) {
    const key = it.key, O = R.opts, did = doneIn(it);
    if (!HOST.meta(key)) throw new Error('not a story on this device');
    hud(title(key) + ' · loading');
    const L = await openStory(key);
    if (!did('load|load')) {
      segOpen('load', key, 'load', { load: L.load, build: L.build });
      await measure(O.load);
      segClose();
    }
    if (it.only === 'load') return;
    const A = app();
    if (!A) throw new Error('no story clock');
    const CH = G(() => { const c = HOST.cur.peek('CH'); return Array.isArray(c) ? c.map(c => ({ key: String(c.key || ''), a: +(c.na !== undefined ? c.na : c.a) || 0, b: +(c.nb !== undefined ? c.nb : c.b) || 0 })) : []; }, []);
    const n = O.chapters ? Math.min(O.chapters, CH.length) : CH.length;
    const keep = () => { const a = app(); if (a && a.mode === 'story' && !a.playing) a.playing = true; showStory(); };
    for (let k = 0; k < n; k++) {
      const c = CH[k], a = app();
      if (did('chapter|' + (k + 1) + ' ' + c.key)) continue;
      if (!a || HOST.curKey !== key) throw new Error('the story went away');
      hud(title(key) + ' · chapter ' + (k + 1) + ' of ' + CH.length);
      if (a.mode !== 'story') a.enterStory(c.a + 0.05); else a.seek(c.a + 0.05);
      a.playing = true;
      await measureAfterSettle(O.settle, keep);
      const len = Math.max(0.5, c.b - c.a), sec = O.full ? len : Math.min(O.ch, len);
      segOpen('chapter', key, (k + 1) + ' ' + c.key);
      await measure(sec, () => { const b = app(); return !b || b.mode !== 'story' || b.t >= c.b; }, keep);
      segClose();
    }
    // explore mode: each tab a while (the stories' own showTab, the tabs their panel lists), else as it opens
    const b = app();
    if (!b) return;
    hud(title(key) + ' · explore mode');
    if (b.mode !== 'explore') b.enterExplore();
    await measureAfterSettle(0.5);
    const tabs = G(() => [...document.querySelectorAll('#explore .tabs [data-tab]')].map(x => x.dataset.tab).filter(t => /^[\w-]{1,30}$/.test(t)), []);
    const can = tabs.length && G(() => HOST.cur.peek("typeof showTab === 'function'"), false);
    if (!can || !O.tabs) { if (did('explore|explore')) return; await measureAfterSettle(O.settle); segOpen('explore', key, 'explore'); await measure(O.ex * 2); segClose(); return; }
    for (const tb of tabs.slice(0, O.tabs)) {
      if (did('explore|' + tb)) continue;
      G(() => HOST.cur.peek('showTab(' + JSON.stringify(tb) + ')'), 0);
      await measureAfterSettle(O.settle);   // (the tab's own build, not its cost)
      segOpen('explore', key, tb);
      await measure(O.ex);
      segClose();
    }
  }
  // the segments an item measured before a headset session ended (it.done: kind|key), not measured again as it goes on
  const doneIn = it => k => !!(it.done && it.done.includes(k));
  // a moment after a seek, not measured (the seek's own frame is not the chapter's cost)
  async function measureAfterSettle(sec, guard) { const t0 = now(); await wait(() => { if (guard) guard(); return now() - t0 >= sec * 1000; }, Infinity); }
  // a studio scene: the studio opened at it (the address it reads as it starts), or, already in the studio, the scene
  // opened there as its Scene pane's Open does (e7g_examples.js exOpen; a relay's as Back to your scenes)
  async function openScene(it) {
    const folder = it.src === 'examples' ? R.opts.examples : '';
    const t0 = now();
    if (HOST.curKey !== 'studio' || !HOST.cur) {
      const L = await openStory('studio', '#studio' + (folder ? '&scenes=' + encodeURIComponent(folder) : '') + '&scene=' + encodeURIComponent(it.name));
      void L;
    } else {
      G(() => HOST.cur.peek('OPT.scenes = ' + JSON.stringify(folder) + '; OPT.scene = ' + JSON.stringify(it.name) + "; openScene('', 'pick'); findSource(); 1"), 0);
    }
    let calm = 0;
    await wait(() => {
      const s = G(() => HOST.cur.peek('STUDIO.state()'), null);
      if (!s || s.scene !== it.name || s.listing !== 'ok') { calm = 0; return false; }
      const busy = Object.values(s.models || {}).some(m => m && (m.state === 'loading' || m.state === 'parsing'));
      if (busy) { calm = 0; return false; }
      if (!calm) calm = now();
      return now() - calm > 1000;
    }, LIMIT.scene * 1000, 'the scene did not load within ' + LIMIT.scene + ' s');
    showStory();
    return Math.round(now() - t0);
  }
  async function runScene(it) {
    const did = doneIn(it);
    hud('Studio · ' + it.name + ' · loading');
    const ms = await openScene(it);
    if (!did('load|' + it.name)) {
      segOpen('load', 'studio', it.name, { load: ms });
      await measure(R.opts.load);
      segClose();
    }
    if (did('scene|' + it.name)) return;
    hud('Studio · ' + it.name);
    segOpen('scene', 'studio', it.name);
    await measure(R.opts.scene, null, showStory);
    segClose();
  }
  // a hands-on step: its card shown, measured until Done (or its time is up), Skip, or Stop
  async function runHand(it) {
    const H = HANDS.find(h => h.id === it.id), O = R.opts;
    if (!H) return;
    const k = R.plan.filter(p => p.kind === 'hand').indexOf(it) + 1, of = R.plan.filter(p => p.kind === 'hand').length;
    if (H.ar && R.xr !== 'ar') { segOpen('hand', HOST.curKey || '', H.id); segClose('only in AR'); return; }
    // what each step needs first
    // (the heavy story, or, where this device has not got it, the story on show or the first)
    const key = HOST.meta(O.story) ? O.story : HOST.curKey && HOST.curKey !== 'studio' ? HOST.curKey : G(() => HOST.list.find(m => !m.intro).key, '');
    if (H.scene) await openScene({ name: O.handScene, src: 'examples' });
    else if (key && HOST.curKey !== key) await openStory(key);
    const A = app();
    if (H.id === 'panel' && A && A.mode !== 'explore') A.enterExplore();
    if (H.occl && HOST.occlusion && HOST.occlusion.set) HOST.occlusion.set(H.occl);
    if (H.id === 'arch') G(() => HOST.cur.peek("typeof XR !== 'undefined' && XR.on ? (XR.stories = true, XR.inStory = false, 1) : 0"), 0);
    else showStory();
    R.handsAns = '';
    const btns = [{ id: 'done', label: 'Done', primary: true }, { id: 'skip', label: 'Skip' }, { id: 'stop', label: 'Stop' }];
    if (H.btn) btns.splice(1, 0, { id: 'menu', label: H.btn });
    card(H.title + ' (' + k + ' of ' + of + ')', [H.say, 'Done when you have done it; it ends by itself after ' + Math.round(O.hand) + ' s.'], btns);
    hud('Hands-on · ' + H.title + ' · ' + k + ' of ' + of);
    segOpen('hand', HOST.curKey || '', H.id);
    await measure(O.hand, () => !!R.handsAns);
    const ans = R.handsAns;
    segClose(ans === 'skip' ? 'skipped' : '');
    card(null);
    if (H.id === 'arch') showStory();
  }

  // ------------------------------------------------------------------ the loop --
  async function loop() {
    while (R.on && R.i < R.plan.length) {
      const it = R.plan[R.i];
      R.cur = R.i; save();
      if (R.quietUntil && now() < R.quietUntil && HOST.collab && HOST.collab.menu && HOST.collab.panelOpen) HOST.collab.panelOpen(false);   // (the menu that opens by itself as a session starts: What is new)
      try {
        if (HOST.collab && HOST.collab.joined) { R.stopWhy = 'a shared room was joined'; break; }
        if (it.kind === 'story') await runStory(it);
        else if (it.kind === 'scene') await runScene(it);
        else if (it.kind === 'hand') await runHand(it);
      } catch (e) {
        if (e === STOP) break;
        // (the segment cut short stays, as the run log has it; the item goes on from there: the segments it finished are
        // not measured again, so the result and the run log agree)
        if (e === PAUSE) { segClose(CUT); it.done = R.segs.filter(g => g.item === R.i && !g.why).map(g => g.kind + '|' + g.key); if (!(await pause())) break; continue; }
        const why = String(e && e.message || e).slice(0, 200);
        if (R.seg) segClose(why);
        else { segOpen(it.kind === 'hand' ? 'hand' : 'load', it.key || (it.kind === 'scene' ? 'studio' : HOST.curKey || ''), it.kind === 'scene' ? it.name : it.id || 'load'); segClose(why); }
        try { CON.warn.call(console, 'Performance run: ' + (it.key || it.name || it.id) + ' failed: ' + why); } catch (x) { /* no console */ }
      }
      R.i++; R.cur = -1; save();
    }
    finish();
  }
  // a headset run whose session ended: held until a session runs again (Enter VR or AR on the card), or stopped
  function pause() {
    R.paused = 'session'; save();
    card('The performance run is waiting', ['The headset view ended. Enter VR or AR to go on where it stopped (' + (R.i + 1) + ' of ' + R.plan.length + ').'], [{ id: 'vr', label: 'Enter VR', primary: true }, { id: 'ar', label: 'Enter AR' }, { id: 'stop', label: 'Stop and show results' }]);
    return new Promise(res => { R.resumeFn = res; });
  }
  function resumed() { if (R.resumeFn) { const f = R.resumeFn; R.resumeFn = null; R.paused = ''; R.xr = xrNow() || R.xr; card(null); f(true); } }

  async function begin(part, o, resume) {
    if (R.on || R.ending) return false;
    // (a kept run in a shared room: closed with its results and its settings put back, not refused on every load)
    if (HOST.collab && HOST.collab.joined) { if (resume) { R.want = null; R.paused = ''; stop('a shared room was joined'); } else refuse(); return false; }
    R.part = part; R.want = null; R.on = true; R.stopWhy = ''; R.done = null; R.paused = '';
    R.xr = xrNow();
    hudPage(true);
    if (resume) {
      Object.assign(R, { id: resume.id, opts: resume.opts, plan: resume.plan, i: resume.i, segs: resume.segs, info: resume.info, saved: resume.saved, at: resume.at, errs: resume.errs || [], errN: resume.errN || 0, emap: errKept(resume.emap), ecut: resume.ecut || 0, ecap: !!resume.ecap, qlog: resume.qlog || [], batt0: resume.batt0, logOwn: false, hz: resume.hz || 0, hzHow: resume.hzHow || '' });
      // (the item that was going when the page went: recorded as failed, so a story that crashes the page is passed over)
      if (resume.cur === resume.i && R.i < R.plan.length) {
        const it = R.plan[R.i];
        R.segs.push({ kind: it.kind === 'hand' ? 'hand' : 'load', story: it.key || (it.kind === 'scene' ? 'studio' : ''), key: it.name || it.id || 'load', why: 'the page reloaded during it', n: 0, item: R.i, w: Date.now() });
        R.i++;
      }
      R.xr = xrNow();
    } else {
      R.opts = opts(o); R.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); R.at = Date.now(); R.i = 0; R.segs = []; R.errs = []; R.errN = 0; R.emap = []; R.ecut = 0; R.ecap = false; R.qlog = [];
      R.saved = snapshot();
      R.plan = await plan(R.opts);
      R.batt0 = await battery();
    }
    await Promise.race([REL, sleep(3000)]);   // (the server's release, for the run's facts)
    pin();
    if (!HOST.session && !R.hz) await probe();
    if (!R.on) { restore(); hud(''); bump(); return false; }   // (stopped before it began: nothing measured)
    R.t0 = now(); R.lost = 0; R.q = undefined; R.quietUntil = now() + 15000; R.set0 = HOST.xrSettled || 0;
    R.info = Object.assign(info(), { opts: R.opts, part: R.part });
    // (developer mode: the notebook's run log carries the run to the relay, its frame times a second and these events;
    // notes.js comes with developer mode, perhaps not yet loaded)
    if (HOST.dev && HOST.dev.on() && !HOST.notes && HOST.mods) await Promise.race([HOST.mods.load('notes').catch(() => null), sleep(5000)]);
    if (HOST.dev && HOST.dev.on() && HOST.notes && HOST.notes.run && !HOST.notes.running()) R.logOwn = !!HOST.notes.run(true);
    runEvent('perfrun', flatInfo(R.info));
    for (const x of R.emap) if (resume || !x.sent) x.sent = errSend(x);   // (caught before the run log ran, or a reload's new run log: the messages so far)
    save();
    card(null);
    notice(part === 'hands' ? 'Hands-on test' : 'Performance run', part === 'hands' ? 'One step at a time: Done or Skip on each card.' : 'It runs by itself. Stop it from the menu\'s Debug tab.', 4000);
    bump();
    loop();
    return true;
  }
  // (R.ending until the result is written: no new run begins while this one winds up)
  function finish() {
    segClose(R.on ? '' : 'stopped');
    const was = R.on;
    R.on = false; R.paused = ''; R.ending = true;
    wake();
    if (R.resumeFn) { const f = R.resumeFn; R.resumeFn = null; f(false); }
    restore();
    hud('');
    R.endP = battery().then(b => {
      const res = result(b);
      errCounts();
      runEvent('perfend', { segs: res.totals.segs, failed: res.totals.failed, dur: res.dur, stopped: res.stopped, batt0: res.batt0, batt1: res.batt1, frames: res.totals.frames, missed: res.totals.missed, errs: res.totals.errs, errd: res.totals.errd, errcut: res.totals.errcut });
      const on = G(() => HOST.notes.running(), false);
      res.log = on ? G(() => HOST.notes.runState().id, '') || '' : '';
      if (!res.log) res.notSent = !(HOST.dev && HOST.dev.on()) ? 'developer mode is off' : 'no run log was recording';
      if (R.logOwn && HOST.notes && HOST.notes.run) HOST.notes.run(false);
      R.logOwn = false;
      R.done = res; lastSum = null;
      let j = JSON.stringify(res);
      if (j.length > 2000000) { res.errors = res.errors.slice(0, 10); j = JSON.stringify(res); }
      put(LAST, j);
      put(KEY, null);
      R.ending = false;
      results(res);
      bump();
    }).catch(() => { R.ending = false; });
    if (was) bump();
  }
  // the result: the run's facts, every segment, the totals and the five worst segments (by frames missed, then p95)
  function result(b1) {
    const segs = R.segs.slice(), ok = segs.filter(g => g.n);
    let frames = 0, sum = 0, missed = 0, worst = 0, stall = 0, qch = 0;
    for (const g of ok) { frames += g.n; sum += (g.mean || 0) * g.n; missed += g.miss || 0; worst = Math.max(worst, g.max || 0); stall = Math.max(stall, g.stall || 0); qch += g.qch || 0; }
    const p95s = ok.map(g => g.p95).sort((a, b) => a - b);
    const bad = segs.filter(g => g.why && !NOTFAIL.includes(g.why));
    const rank = g => (g.n ? (g.miss || 0) / g.n : -1);
    const worst5 = ok.slice().sort((a, b) => rank(b) - rank(a) || (b.p95 || 0) - (a.p95 || 0)).slice(0, 5);
    return {
      v: V, kind: 'perfrun', part: R.part, id: R.id, at: R.at, end: Date.now(), dur: Math.round((Date.now() - R.at) / 1000), release: (R.info && R.info.release) || shellRel() || R.rel || '', served: R.rel || '',
      info: R.info, stopped: R.stopWhy || '', batt0: R.batt0, batt1: b1,
      totals: { segs: segs.length, failed: bad.length, frames, mean: frames ? r2(sum / frames) : null, p95: p95s.length ? p95s[Math.floor(p95s.length / 2)] : null, missed, missPct: frames ? r1(100 * missed / (frames + missed)) : null, worst: r2(worst), stall: r1(stall), errs: R.errN, errd: R.emap.length, errcut: R.ecut, qch, lost: R.lost, long: segs.reduce((a, g) => a + (g.long || 0), 0), settled: Math.max(0, (HOST.xrSettled || 0) - (R.set0 || 0)) },
      worst: worst5.map(g => ({ kind: g.kind, story: g.story, key: g.key, mean: g.mean, p95: g.p95, miss: g.miss, n: g.n })),
      failed: bad.map(g => ({ kind: g.kind, story: g.story, key: g.key, why: g.why })),
      segs, errors: R.errs.slice(), errlist: errList(), quality: R.qlog.slice(),
    };
  }
  function stop(why) {
    if (R.want) { const res = R.want.resume; R.want = null; card(null); bump(); if (!res) return true; }
    if (!R.on) {
      // (a run kept from before a reload, not going on: put its settings back and keep what it measured)
      const s = R.ending ? null : loadSaved();
      if (s) { R.saved = s.saved; Object.assign(R, { id: s.id, part: s.part, opts: s.opts, plan: s.plan, segs: s.segs, info: s.info, at: s.at, errs: s.errs || [], errN: s.errN || 0, emap: errKept(s.emap), ecut: s.ecut || 0, ecap: !!s.ecap, qlog: s.qlog || [], batt0: s.batt0, i: s.i }); R.stopWhy = why || 'stopped'; R.on = true; finish(); return true; }
      return false;
    }
    R.stopWhy = why || 'stopped';
    R.on = false;
    wake();
    if (R.resumeFn) { const f = R.resumeFn; R.resumeFn = null; f(false); }
    return true;
  }
  function refuse() {
    const t = 'The performance run does not run in a shared room. Leave the room first.';
    notice('Not in a shared room', t, 5000);
    card('Performance run', [t], [{ id: 'close', label: 'Close', primary: true }]);
  }
  // once a run: the release, the device and browser, the display, the view, VR or AR, the settings that bear on speed
  function info() {
    const s = HOST.session, bl = G(() => s.renderState.baseLayer, null), x = HOST.xr || {}, ua = navigator.userAgent;
    const set = {};
    for (const k of ['fps', 'hz', 'auto', 'rateStep', 'sharp', 'walk', 'scale', 'fov', 'body']) { const v = G(() => (typeof x[k] === 'function' ? x[k]() : undefined), undefined); if (v !== undefined && (typeof v !== 'object' || v === null)) set[k] = v; }
    set.occl = G(() => HOST.occlusion.mode(), null);
    set.bodies = G(() => localStorage.getItem('collabBodies') !== 'off', null);
    const hs = G(() => HOST.xr.hzState(), null);
    return {
      release: shellRel() || R.rel, served: R.rel, shell: G(() => HOST.shell.n, null), device: /OculusBrowser|Quest|Pico|Wolvic/i.test(ua) ? 'headset' : /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? 'tablet' : /iPhone|Android|Mobile/i.test(ua) ? 'phone' : 'desktop',
      model: (/Quest\s?(3S|3|Pro|2)/i.exec(ua) || [])[0] || '', browser: (/OculusBrowser\/([\d.]+)/.exec(ua) || /(?:Chrome|Firefox|Version)\/([\d.]+)/.exec(ua) || [])[0] || '', ua: ua.slice(0, 200),
      xr: xrNow(), hz: rate(), hzHow: rateHow(), hzList: hs && hs.list ? hs.list.join(',') : '', eyeW: bl ? Math.round(bl.framebufferWidth / 2) : null, eyeH: bl ? bl.framebufferHeight : null,
      fbScale: G(() => HOST.xr.scaleNow(), null), fov: G(() => HOST.xr.fovNow(), null), screen: innerWidth + 'x' + innerHeight + '@' + (+(devicePixelRatio || 1).toFixed(2)), settings: set,
    };
  }
  function flatInfo(I) {
    const o = { id: R.id, part: R.part, release: I.release, device: I.device, model: I.model, browser: I.browser, xr: I.xr, hz: I.hz, hzHow: I.hzHow, hzList: I.hzList, eyeW: I.eyeW, eyeH: I.eyeH, fbScale: I.fbScale, fov: I.fov, items: R.plan.length, batt0: R.batt0 };
    const S = I.settings || {};
    for (const k of ['fps', 'auto', 'sharp', 'occl', 'bodies']) if (S[k] !== undefined && S[k] !== null) o[k] = typeof S[k] === 'object' ? String(S[k]) : S[k];
    o.opts = JSON.stringify({ ch: I.opts.ch, full: I.opts.full, ex: I.opts.ex, aq: I.opts.aq, scenes: I.opts.scenes, stories: I.opts.stories }).slice(0, 200);
    return o;
  }
  async function battery() { try { if (!navigator.getBattery) return null; const b = await navigator.getBattery(); return Math.round(b.level * 100) + (b.charging ? '+' : ''); } catch (e) { return null; } }

  // ------------------------------------------------------------------ what shows: the card and the read-out --
  // The card: one model for the page (an HTML card, #perfCard) and the headset (shared.js draws it on a sheet of its own
  // that the ray and the finger press: drawPerf). The read-out: one line, changed only as a segment begins (so it costs
  // nothing while a segment is measured but its one draw call: a canvas of 800 x 120 in a headset, a line of text on a page)
  function card(t, lines, buttons) {
    R.card = t ? { title: t, lines: lines || [], buttons: buttons || [], n: ++R.cardN } : null;
    bump();
  }
  function hud(t) {
    const left = R.plan.length ? ' · ' + Math.min(R.i + 1, R.plan.length) + ' of ' + R.plan.length : '';
    const last = R.segs.length ? R.segs[R.segs.length - 1] : null;
    R.hud = t ? (R.part === 'hands' ? '' : 'Performance run' + left + ' · ') + t + (last && last.n ? ' · last ' + last.mean + ' ms, ' + last.miss + ' missed' : '') : '';
    bump();
  }
  function results(res) {
    const X = res.totals, L = [];
    L.push(`${X.segs} segments, ${X.failed} failed, in ${mmss(res.dur)}.` + (res.stopped ? ' Stopped: ' + res.stopped + '.' : ''));
    L.push(`Frames ${X.frames}: mean ${X.mean} ms, median p95 ${X.p95} ms, worst ${X.worst} ms; ${X.missed} refreshes missed (${X.missPct} % of them), longest stall ${X.stall} ms` + (X.long ? `; ${X.long} pauses of a second or more` : '') + '.' + (res.info && res.info.hzHow && res.info.hzHow !== 'session' ? ` (Display rate ${res.info.hz || '?'} Hz, ${res.info.hzHow}.)` : ''));
    if (X.errs || X.qch || X.lost) L.push(`${X.errs} errors or warnings` + (X.errd ? ` (${X.errd} different)` : '') + `, ${X.qch} quality changes` + (X.lost ? `, the WebGL context lost ${X.lost} times` : '') + '.');
    const often = (res.errlist || []).slice().sort((a, b) => b.n - a.n || a.at - b.at).slice(0, 2);
    if (often.length) L.push('Most often: ' + often.map(x => x.msg.slice(0, 90) + ' (' + x.n + (x.n > 1 ? ' times' : ' time') + ')').join('; ') + '.');
    if (res.worst.length) { L.push('The five worst:'); for (const g of res.worst) L.push(`${title(g.story)} ${g.kind === 'chapter' ? 'ch ' + g.key : g.key}: ${g.mean} ms, p95 ${g.p95}, ${g.miss} missed`); }
    if (res.failed.length) L.push('Failed: ' + res.failed.slice(0, 4).map(g => title(g.story) + ' ' + g.key + ' (' + g.why + ')').join('; ') + (res.failed.length > 4 ? '; ...' : '') + '.');
    L.push('Kept on this device' + (res.log ? ', and in run log ' + res.log + ' on the relay' : '. Not sent to the relay: ' + (res.notSent || 'developer mode is off')) + '.');
    const B = [{ id: 'close', label: 'Close', primary: true }];
    if (!HOST.session) B.unshift({ id: 'json', label: 'Download JSON' });
    if (res.part === 'run') B.push({ id: 'hands', label: 'Hands-on test' });
    card(res.part === 'hands' ? 'Hands-on test: results' : 'Performance run: results', L, B);
  }
  function view() {
    const hudOn = R.on && R.hud && R.opts && R.opts.hud && !R.card;
    return { hud: hudOn ? R.hud : '', card: R.card, sig: R.sig };
  }
  // a button pressed (the page's card, the headset's sheet, tests)
  function press(id) {
    const c = R.card;
    if (id === 'done' || id === 'skip') { R.handsAns = id; return true; }
    if (id === 'menu') { if (HOST.collab && HOST.collab.panelOpen) HOST.collab.panelOpen(true); return true; }
    if (id === 'stop') { if (R.paused) { stop('stopped'); card(null); } else stop('stopped'); return true; }
    if (id === 'close') { card(null); if (R.want) { R.want = null; bump(); } return true; }
    if (id === 'json') { download(R.done || G(() => JSON.parse(get(LAST)), null)); return true; }
    if (id === 'hands') { card(null); R.want = null; start({ part: 'hands', where: HOST.session || XRS.vr ? '' : 'page' }); return true; }
    if (id === 'run') { card(null); start({ part: 'run', where: 'page' }); return true; }
    if (id === 'page') { const w = R.want; card(null); if (w) { R.want = null; begin(w.part, w.o, w.resume); } return true; }
    if (id === 'vr' || id === 'ar') { enter(id); return true; }
    if (id === 'resume') { const s = loadSaved(); card(null); if (s) begin(s.part, null, s); return true; }
    void c;
    return false;
  }
  // Enter VR or AR, within the press (a session needs one): the story's own button, or the start page's (HOST.bare)
  function enter(mode) {
    const b = document.getElementById(mode === 'ar' ? 'btnAR' : 'btnVR');
    if (!R.want && !R.paused) R.want = { part: 'run', o: {} };
    if (b) b.click();
  }
  function download(res) {
    if (!res) return;
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(res, null, 1)], { type: 'application/json' }));
      a.download = 'perfrun-' + (res.release || 'app') + '-' + new Date(res.at || Date.now()).toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) { /* no download here */ }
  }

  // ---- the page's card and read-out
  const UI = { card: null, hud: null, sig: -1 };
  function build() {
    if (UI.card) return;
    const st = document.createElement('style');
    st.textContent = `#perfCard { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 30; width: min(520px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; box-sizing: border-box; padding: 20px 22px; border-radius: 14px; background: #0f1a2c; color: #e7eef8; border: 1px solid #ffffff33; box-shadow: 0 8px 40px #000a; font: 15px/1.45 system-ui, sans-serif; }
#perfCard[hidden], #perfHud[hidden] { display: none; }
#perfCard h2 { margin: 0 0 10px; font-size: 19px; }
#perfCard p { margin: 0 0 8px; }
#perfCard .row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
#perfCard button { font: inherit; padding: 8px 14px; border-radius: 8px; border: 1px solid #ffffff44; background: #ffffff14; color: inherit; cursor: pointer; }
#perfCard button.primary { background: #46d9ff; color: #04131c; border-color: #46d9ff; font-weight: 700; }
#perfHud { position: fixed; left: max(16px, env(safe-area-inset-left, 0px)); bottom: calc(var(--fc-bot, 0px) + 16px + env(safe-area-inset-bottom, 0px)); z-index: 29; max-width: calc(100vw - 120px); display: flex; gap: 10px; align-items: center; padding: 6px 8px 6px 12px; border-radius: 10px; background: #0b1424ee; color: #e6edf7; font: 13px/1.35 system-ui, sans-serif; border: 1px solid #ffffff22; }
#perfHud button { font: inherit; padding: 4px 10px; border-radius: 6px; border: 1px solid #ffffff44; background: #b8452a; color: #fff; cursor: pointer; }`;
    document.head.appendChild(st);
    const c = UI.card = document.createElement('div'); c.id = 'perfCard'; c.hidden = true; c.setAttribute('role', 'dialog'); c.setAttribute('aria-live', 'polite');
    const h = UI.hud = document.createElement('div'); h.id = 'perfHud'; h.hidden = true; h.setAttribute('role', 'status');
    h.innerHTML = '<span></span><button type="button" data-perf="stop">Stop</button>';
    document.body.append(c, h);
    const on = e => { const b = e.target.closest('[data-perf]'); if (b) press(b.dataset.perf); };
    c.addEventListener('click', on); h.addEventListener('click', on);
  }
  function hudPage() { build(); paint(); }
  function paint() {
    if (!UI.card || UI.sig === R.sig) return;
    UI.sig = R.sig;
    const c = R.card;
    UI.card.hidden = !c;
    if (c) {
      UI.card.textContent = '';
      const h = document.createElement('h2'); h.textContent = c.title; UI.card.appendChild(h);
      for (const l of c.lines) { const p = document.createElement('p'); p.textContent = l; UI.card.appendChild(p); }
      const row = document.createElement('div'); row.className = 'row';
      for (const b of c.buttons) { const e = document.createElement('button'); e.type = 'button'; e.dataset.perf = b.id; e.textContent = b.label; if (b.primary) e.className = 'primary'; row.appendChild(e); }
      UI.card.appendChild(row);
    }
    const t = R.on && R.hud && !(R.opts && !R.opts.hud) ? R.hud : '';
    UI.hud.hidden = !t;
    UI.hud.firstChild.textContent = t;
  }

  // ------------------------------------------------------------------ starting --
  // start({ part: 'run' | 'hands', where: '' (a headset session: now if one runs, else the card asks for one) | 'page',
  // ...options }); offer(): the page's card with both parts
  function start(o) {
    o = o || {};
    const part = o.part === 'hands' ? 'hands' : 'run';
    if (R.on) return false;
    if (R.ending) { Promise.resolve(R.endP).then(() => start(o)); return true; }   // (once the run before has written its result)
    if (HOST.collab && HOST.collab.joined) { refuse(); return false; }
    build();
    if (HOST.session || o.where === 'page') return begin(part, o);
    R.want = { part, o };
    R.cardFn = () => startCard(part, o);
    R.cardFn();
    return true;
  }
  // (Enter VR and Enter AR only where this browser has them: XRS, asked as the file loads; the card drawn again once known)
  function startCard(part, o) {
    const vr = XRS.vr, ar = XRS.ar;
    card(part === 'hands' ? 'Hands-on test' : 'Performance run', [
      part === 'hands' ? 'About ' + mins(aboutHands(o)) + ' in ' + title(opts(o).story) + ': one card at a time tells you what to do, each with Done and Skip.' : 'It plays every story and some studio scenes by itself, chapter by chapter, and measures every frame. About ' + about(o) + ' minutes.',
      vr ? 'Enter VR or AR: it starts as the headset view begins and then runs alone. Narration and effects are quiet while it runs.' : 'This browser has no VR: it runs on this page.',
      sendLine(part === 'hands' ? aboutHands(o) : about(o)),
    ], [vr && { id: 'vr', label: 'Enter VR', primary: true }, ar && { id: 'ar', label: 'Enter AR' }, { id: 'page', label: 'Run on this page', primary: !vr }, { id: 'close', label: 'Not now' }].filter(Boolean));
  }
  // where the results go: the relay only with developer mode on (the notebook's run log, which ends after two hours)
  const mins = m => m + (m === 1 ? ' minute' : ' minutes');
  function sendLine(min) {
    if (!(HOST.dev && HOST.dev.on())) return 'The results stay on this device. To send them to the relay as well, turn developer mode on first.';
    return 'The results stay on this device and go to the relay as a run log.' + (min > 110 ? ' A run log ends after two hours: what comes later stays on this device only.' : '');
  }
  function offer() {
    build();
    if (R.on) { bump(); return; }
    R.want = { part: 'run', o: {} };
    R.cardFn = offerCard;
    offerCard();
  }
  function offerCard() {
    const vr = XRS.vr, ar = XRS.ar;
    card('Performance run', ['Two parts. The run-through plays every story and some studio scenes by itself and measures every frame (about ' + about({}) + ' minutes). The hands-on test is about ' + mins(aboutHands({})) + ' of things only a person can do.',
      vr ? 'Enter VR or AR to run the run-through in the headset, or run it on this page.' : 'This browser has no VR: it runs on this page.', sendLine(about({}))],
    [vr && { id: 'vr', label: 'Enter VR', primary: true }, ar && { id: 'ar', label: 'Enter AR' }, { id: 'page', label: 'Run on this page', primary: !vr }, { id: 'hands', label: 'Hands-on test' }, { id: 'close', label: 'Not now' }].filter(Boolean));
  }
  // the boot (index.html): #perfrun or #handson in the address (options with pr... keys), or a run kept from before a
  // reload: on a page it goes on by itself; a headset run asks for a session first
  function boot(hp) {
    build();
    const s = loadSaved();
    const asked = !!(hp && (hp.has('perfrun') || hp.has('handson')));
    if (s) {
      // (closed with its results, its settings put back: too old, made by another release, or a new run asked for; then
      // the new one starts)
      const rel = shellRel(), why = Date.now() - (+s.at || 0) > LIMIT.maxAge ? 'the page was away too long' : s.rel && rel && s.rel !== rel ? 'a new release came meanwhile (' + s.rel + ' to ' + rel + ')' : asked ? 'a new run was asked for' : '';
      if (why) { stop(why); if (asked) Promise.resolve(R.endP).then(() => boot(hp)); return; }
      if (!s.xr) { setTimeout(() => begin(s.part, null, s), 1500); return; }
      // (a headset run waits for a session: the device's settings are put back meanwhile, and pinned again as it goes on)
      R.saved = s.saved; restore();
      R.paused = 'reload';
      R.want = { part: s.part, o: null, resume: s };
      card('The performance run is waiting', ['The page reloaded at ' + (s.i + 1) + ' of ' + s.plan.length + '. Enter ' + (s.xr === 'ar' ? 'AR' : 'VR') + ' to go on where it stopped.'],
        [{ id: s.xr === 'ar' ? 'ar' : 'vr', label: 'Enter ' + (s.xr === 'ar' ? 'AR' : 'VR'), primary: true }, { id: 'page', label: 'Go on on this page' }, { id: 'stop', label: 'Stop and show results' }]);
      return;
    }
    if (!hp) return;
    const o = fromHash(hp);
    if (hp.has('perfrun') || hp.has('handson')) {
      o.part = hp.has('handson') && !hp.has('perfrun') ? 'hands' : 'run';
      if (hp.get('prgo') === 'page' || hp.get('perfrun') === 'page' || hp.get('handson') === 'page') o.where = 'page';
      setTimeout(() => start(o), 300);
    }
  }
  // a second's timer: a waiting start begins as a session does; a paused run goes on; quality changes; the card's sig
  setInterval(() => {
    if (R.want && HOST.session && !R.on) { const w = R.want; R.want = null; R.paused = ''; card(null); begin(w.part, w.o || {}, w.resume); }
    if (R.paused === 'session' && HOST.session) resumed();
    if (R.on) {
      if (hidden()) R.lastT = 0;
      const q = aq();
      if (R.q !== undefined && q !== R.q && q) { R.qlog.push({ at: Math.round((Date.now() - R.at) / 1000), from: R.q, to: q, why: G(() => String(HOST.xr.aq().why || '').slice(0, 120), '') }); if (R.seg) R.seg.qch++; }
      R.q = q;
      if (HOST.collab && HOST.collab.joined && !R.stopWhy) stop('a shared room was joined');
    }
  }, 250);

  return {
    start, offer, stop, boot, frame, view, press, rec,
    // about how long each part takes, in minutes (the Experiments set's cards in developer mode: HOST.menu, v230)
    minutes: part => (part === 'hands' ? aboutHands({}) : about({})),
    // the shell's holds while a run is on: sound quiet (HOST.audio's mute, never stored), no slideshow stops, no Repeat, no
    // live update or reload (index.html)
    on: () => R.on, hush: () => R.on, hold: () => R.on,
    // for the menu's Debug tab and tests
    state: () => ({ on: R.on, part: R.part, want: !!R.want, paused: R.paused, id: R.id, i: R.i, of: R.plan.length, segs: R.segs.length, hud: R.hud, card: R.card ? { title: R.card.title, buttons: R.card.buttons.map(b => b.id) } : null, xr: R.xr, line: line() }),
    sig: () => R.sig + (R.on ? ':' + R.i : ''),
    result: () => R.done || G(() => JSON.parse(get(LAST)), null),
    plan: () => R.plan.slice(), opts: () => Object.assign({}, R.opts), hands: () => HANDS.map(h => h.id),
    test(o) { if (o && o.tick > 0) T.tick = +o.tick; return Object.assign({}, T); },
  };
  // (the last result's line made once: the menu's Debug tab asks for it every frame, and the result is up to 2 MB)
  function line() {
    if (R.on) return (R.part === 'hands' ? 'Hands-on test, step ' : 'Running: ') + Math.min(R.i + 1, R.plan.length) + ' of ' + R.plan.length + (R.hud ? '. ' + R.hud.replace(/^Performance run · \d+ of \d+ · /, '') : '');
    if (R.want) return 'Waiting for the headset view to begin';
    if (lastSum === null) {
      const r = R.done || G(() => JSON.parse(get(LAST)), null);
      lastSum = r && r.totals ? 'Last run ' + new Date(r.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ': ' + r.totals.segs + ' segments, ' + r.totals.missPct + ' % of refreshes missed' : 'Every story and scene by itself, each frame measured';
    }
    return lastSum;
  }
});

// The headset bench (HOST.bench, v232; tools/bench/SPEC.md, docs/agents/shell.md "The headset bench"). The owner, 28 November
// 2026: "We just put the Quest into some mode, and then it accepts commands from you or from some JSON file from the relay
// so you can test whatever you just need", "with and without adb"; "my headset is set to 4 hours anyway and the sensor is
// covered". Bench mode is this device's own, developer mode only, never in a shared room and never on the main site: it
// asks the relay (started with --bench) for jobs by long poll (GET /api/bench/next, the relay's password as a Bearer
// header), runs each job's steps from a fixed list of commands (report, open, seek, play, pause, explore, set, measure,
// rays, pic, probe, script, wait, reload), and posts the result back. A probe is a file of bench/probes/ loaded by name
// from this origin. The one exception to committed code (the owner, 28 November 2026: "can also be uncommitted code if
// that makes things faster") is a script step (SPEC 14): its code run as a probe is, only when the relay it came from
// says it was started with --bench-scripts (which always needs the password), never on the main site, only while bench
// mode is on, and never from the automatic plan. Nothing else here turns a job's field into code. The headset settings a job sets are borrowed (benchBorrow) and put back as it ends, after a crash or a reload
// too. Segments are measured by perfrun.js's recorder (HOST.perfRun.rec); the eye picture is read back as the notebook
// reads it (notes.js grab); pretend controller rays go through the groups three.js owns, from index.html's one seam
// (makeRenderer's frame wrapper: pre before the story's frame, post after it). Nothing here is a room's, a story's state
// or a stored setting of the owner's. The fixed view (v233, SPEC 15; the owner: "make sure that every story is always in
// front of the headset at the same place so we get measurable results; the headset could be in any position"): while a
// job with a session runs, the shell answers three.js from a space carried with the head (HOST.xr.benchView), so the head
// reads level at 1.6 m facing -z however the headset lies, and the story is recentred there; anchors are lent for the job
// (HOST.anchor.pause).
// (loaded on demand, HOST.mods: run with HOST.quiet set, so its listeners and timers are the shell's)
HOST.bench = (HOST.quietly || (fn => fn()))(function () {
  'use strict';
  const DENY = 'stories.lbi-netmed.com';   // (BENCH_DENY: the main site, whatever its relay says)
  const G = (fn, d) => { try { const v = fn(); return v === undefined ? d : v; } catch (e) { return d; } };
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const put = (k, v) => { try { if (v === null || v === undefined) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* storage blocked or full */ } };
  const getJ = k => G(() => JSON.parse(get(k) || 'null'), null);
  const now = () => performance.now();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const r2 = v => (v == null || !isFinite(v) ? null : Math.round(v * 100) / 100);
  const app = () => G(() => HOST.cur.collab.APP, null);
  const xrNow = () => (HOST.session ? (/ar/i.test(HOST.mode || '') && !/vr/i.test(HOST.mode || '') ? 'ar' : 'vr') : '');
  const KEYRE = /^[a-z][a-z0-9-]{0,31}$/, NAMERE = /^[\w .-]{1,80}$/, HOURS = 12;
  const OUTMAX = 64 << 10;

  // ------------------------------------------------------------------ state --
  // on, until: bench mode and when it ends by itself; hs: this device's id; want: what #benchEnter asks for; plan: the plan
  // run after an update; phase, why: what the bar and the line say; job: the job running; press: #benchEnter's presses;
  // misses, cuts: asks that went unanswered, long polls cut short; waiting: jobs queued that need a session
  const B = { on: false, until: 0, hs: '', want: 'ar', plan: 'dev', phase: 'off', why: '', job: null, press: { n: 0, trusted: false, at: 0, err: '' },
    misses: 0, cuts: 0, waiting: 0, auto: null, scripts: false, loop: 0, ac: null, relay: null, pingAt: 0, helloAt: 0, helloSig: '', idleSince: 0, sig: 0, errs: 0, frameN: 0, picWant: null, rays: null, probes: {}, loading: '', back: '', fell: null };
  const T = { ask: 20, idle: 20000, hello: 60000, lostMs: 30000 };   // (tests shorten them: test())
  const bump = () => { B.sig++; paint(); };
  // this device's id: eight letters and digits, made once
  B.hs = (() => { let h = get('benchId'); if (!/^[a-z0-9]{8}$/.test(h || '')) { const a = 'abcdefghijklmnopqrstuvwxyz0123456789', r = new Uint8Array(8); crypto.getRandomValues(r); h = [...r].map(b => a[b % 36]).join(''); put('benchId', h); } return h; })();
  B.want = get('benchXr') === 'vr' ? 'vr' : 'ar';
  B.plan = (v => (v === 'none' || KEYRE.test(v || '') ? v : 'dev'))(get('benchPlan'));

  // ------------------------------------------------------------------ settings a job borrows (SPEC 6.3) --
  // keys: the localStorage keys the setter writes (the own look's setters write all seven); ok: the value as the setter
  // takes it, or undefined; mod: the module the setter lives in
  const LOOK = ['xrLabels2', 'xrCards', 'xrFree', 'xrSubs', 'sfxOn', 'narrationOn', 'xrNarration'];
  const bool = v => (v === true || v === 'on' ? true : v === false || v === 'off' ? false : undefined);
  const among = list => v => (list().includes(v) ? v : undefined);
  const X = () => HOST.xr;
  const SET = {
    occl: { keys: ['xrOccl'], mod: 'occlusion', ok: among(() => ['off', 'depth', 'room', 'both']), get: () => HOST.occlusion.own(), set: v => HOST.occlusion.set(v) },
    occlSmooth: { keys: ['xrOcclSmooth'], mod: 'occlusion', ok: bool, get: () => HOST.occlusion.smooth(), set: v => HOST.occlusion.setSmooth(v) },
    auto: { keys: ['xrAuto'], ok: bool, get: () => X().auto(), set: v => X().setAuto(v) },
    hz: { keys: ['xrHz'], ok: v => (Number.isInteger(+v) && +v >= 30 && +v <= 240 ? +v : undefined), get: () => X().hz(), set: v => X().setHz(v) },
    fps: { keys: ['xrFps'], ok: bool, get: () => X().fps(), set: v => X().setFps(v) },
    labels: { keys: LOOK, ok: among(() => ['face', 'fixed', 'hidden']), get: () => X().labels(), set: v => X().setLabels(v) },
    cards: { keys: LOOK, ok: among(() => ['face', 'fixed', 'hidden']), get: () => X().cards(), set: v => X().setCards(v) },
    free: { keys: LOOK, ok: bool, get: () => X().free(), set: v => X().setFree(v) },
    subs: { keys: LOOK, ok: bool, get: () => !!X().mine('subs'), set: v => X().setSubsDevice(v) },
    sfx: { keys: LOOK, ok: bool, get: () => X().sfx(), set: v => X().setSfx(v) },
    walk: { keys: ['xrWalk'], ok: bool, get: () => X().walk(), set: v => X().setWalk(v) },
    sharp: { keys: ['xrSharp2'], ok: among(() => ['off', 'layer', 'text', 'front']), get: () => X().sharp(), set: v => X().setSharp(v) },
    scale: { keys: ['xrScale'], ok: v => { const s = X().scales(); return s.find(x => x === v || String(x) === String(v)); }, get: () => X().scale(), set: v => X().setScale(v) },
    fov: { keys: ['xrFov'], ok: v => { const s = X().fovs(); return s.find(x => x === v || String(x) === String(v)); }, get: () => X().fov(), set: v => X().setFov(v) },
    body: { keys: ['xrBody'], ok: bool, get: () => X().body(), set: v => X().setBody(v) },
  };
  // the raw values first (what was there is what comes back, a key never set among them), then the setter
  async function borrow(name, value) {
    const S = Object.prototype.hasOwnProperty.call(SET, name) ? SET[name] : null;
    if (!S) throw new Error('not a setting the bench may borrow: ' + String(name).slice(0, 30));
    if (S.mod && HOST.mods) await HOST.mods.load(S.mod);
    if (S.mod === 'occlusion' && !HOST.occlusion) throw new Error('real-world occlusion did not load');
    const v = S.ok(value);
    if (v === undefined) throw new Error('not a value for ' + name + ': ' + String(value).slice(0, 30));
    const b = getJ('benchBorrow') || { job: B.job ? B.job.id : '', at: Date.now(), raw: {}, old: {} };
    for (const k of S.keys) if (!(k in b.raw)) b.raw[k] = get(k);
    const was = S.get();
    if (!(name in b.old)) b.old[name] = was;
    put('benchBorrow', JSON.stringify(b));
    S.set(v);
    return { name, was, now: G(() => S.get(), v) };
  }
  // put back: the setters with the old values, then the raw values (so a key never set is unset again); true when
  // there was anything to put back
  function giveBack() {
    const b = getJ('benchBorrow');
    if (!b) return false;
    for (const [name, v] of Object.entries(b.old || {})) {
      const S = SET[name];
      if (!S || (S.mod === 'occlusion' && !HOST.occlusion)) continue;   // (occlusion.js reads the raw value as it loads)
      try { if (S.get() !== v) S.set(v); } catch (e) { /* the setter is not here */ }
    }
    for (const [k, v] of Object.entries(b.raw || {})) put(k, v);
    put('benchBorrow', null);
    return true;
  }
  // (on every boot, before anything else of the bench: a crash or a reload in the middle of a job)
  B.back = giveBack() ? 'settings borrowed by a job before a reload were put back' : '';

  // ------------------------------------------------------------------ switching on and off --
  const denied = () => location.hostname === DENY;
  const devOn = () => !!(HOST.dev && HOST.dev.on());
  function set(on, why) {
    on = !!on;
    if (on && !devOn()) { notice('Bench mode', 'Bench mode needs developer mode: turn developer mode on first.'); return false; }
    if (on === B.on) return B.on;
    if (on) {
      B.on = true; B.until = Date.now() + HOURS * 3600 * 1000;
      put('benchOn', JSON.stringify({ until: B.until }));
      B.misses = 0; B.cuts = 0; B.relay = null; B.pingAt = 0; B.idleSince = now();
      loop();
    } else {
      B.on = false; B.until = 0;
      put('benchOn', null);
      if (B.job) B.job.stop = why || 'bench mode was switched off';
      if (B.ac) try { B.ac.abort(); } catch (e) { /* gone */ }
      raysEnd();
      if (!B.job) giveBack();
      B.phase = 'off'; B.why = '';
    }
    bump();
    return B.on;
  }
  const notice = (t, x) => { try { const L = HOST.notesLink; if (L && L.notice) L.notice(t, x, 6000); } catch (e) { /* no notice */ } };

  // ------------------------------------------------------------------ the relay --
  // the relay this page knows (HOST.collab.relayFind) and its password; a 401 brings up the shell's own prompts
  async function relay(again) {
    if (B.relay && !again) return B.relay;
    const r = G(() => (HOST.collab && HOST.collab.relayFind ? HOST.collab.relayFind() : null), null);
    const f = r ? await r.catch(() => null) : null;
    B.relay = f && f.base ? { base: String(f.base).replace(/\/+$/, ''), token: f.token || '' } : null;
    return B.relay;
  }
  async function call(path, o) {
    o = o || {};
    const R = await relay();
    if (!R) throw Object.assign(new Error('no relay'), { status: 0 });
    const h = Object.assign({}, R.token ? { Authorization: 'Bearer ' + R.token } : {}, o.type ? { 'Content-Type': o.type } : o.body !== undefined ? { 'Content-Type': 'application/json' } : {});
    const ab = o.ac || new AbortController(), to = setTimeout(() => ab.abort(), o.ms || 15000);
    let r;
    try {
      r = await fetch(R.base + path, { method: o.body !== undefined ? 'POST' : 'GET', cache: 'no-store', headers: h, signal: ab.signal,
        body: o.body === undefined ? undefined : o.type ? o.body : JSON.stringify(o.body) });
    } finally { clearTimeout(to); }
    if (r.status === 401) { try { HOST.collab.relaySaw(R.base, 401, R.token, null); } catch (e) { /* no prompts here */ } B.relay = null; }
    let j = null;
    if (r.status !== 204) try { j = await r.json(); } catch (e) { /* not JSON */ }
    return { status: r.status, j, r };
  }
  // the relay's ping: has it a bench? (asked again a minute on, and after a refusal)
  async function ping() {
    if (B.pingOk && now() - B.pingAt < 60000) return '';
    B.pingAt = now(); B.pingOk = false;
    const R = await relay(true);
    if (!R) return 'no relay';
    let a;
    try { a = await call('/api/ping', { ms: 8000 }); } catch (e) { return 'no relay'; }
    if (a.status === 401) return 'the relay wants its password';
    if (!a.j || !a.j.bench) return 'the relay has no bench';
    B.pingOk = true; B.scripts = !!a.j.benchScripts;
    return '';
  }

  // ------------------------------------------------------------------ the phase --
  function heldWhy() {
    if (G(() => !!(HOST.collab && HOST.collab.code), false)) return 'in a shared room';
    if (denied()) return 'main site';
    if (!devOn()) return 'developer mode is off';
    return '';
  }
  function phaseSet(p, why) {
    if (p === B.phase && (why || '') === B.why) return;
    B.phase = p; B.why = why || '';
    bump();
  }
  const phaseNow = () => (B.job ? 'busy' : B.misses >= 3 ? 'lost' : !HOST.session ? 'enter' : 'idle');

  // ------------------------------------------------------------------ the loop: ask, run, tell --
  async function loop() {
    const me = ++B.loop;
    await sleep(0);
    while (B.on && me === B.loop) {
      if (Date.now() > B.until) { set(false, 'twelve hours passed'); break; }
      const h = heldWhy() || (await ping());
      if (!B.on || me !== B.loop) break;
      if (h) {
        phaseSet('held', h);
        // (the relay hears of a held headset, a minute apart; never from the main site or with developer mode off)
        if (h !== 'main site' && h !== 'developer mode is off' && (now() - B.helloAt > T.hello || B.helloSig !== B.phase + B.why + xrNow())) await hello();
        await sleep(h === 'developer mode is off' ? 2000 : 5000);
        continue;
      }
      if (HOST.perfRun && HOST.perfRun.on && HOST.perfRun.on()) { phaseSet('held', 'the performance run is on'); await sleep(5000); continue; }
      // (a job kept from before a reload: failed, said once)
      const kept = getJ('benchJob');
      if (kept && kept.id) { put('benchJob', null); await send(kept.id, 'result', { hs: B.hs, ok: false, why: 'the page reloaded during step ' + ((+kept.step || 0) + 1) + (B.back ? ' (' + B.back + ')' : ''), t0: kept.at || 0, t1: Date.now(), steps: [], report: null }).catch(() => {}); }
      if (B.phase === 'held' || B.phase === 'off') phaseSet(phaseNow());
      if (now() - B.helloAt > T.hello || B.helloSig !== B.phase + B.why + xrNow()) await hello();
      if (await takeShell()) break;
      if (await autoPlan()) continue;
      const lost = B.misses >= 3, wait = lost ? 5 : B.cuts >= 3 ? 5 : T.ask, t0 = now();
      let a = null;
      B.ac = new AbortController();
      try { a = await call('/api/bench/next?hs=' + B.hs + '&xr=' + xrNow() + '&wait=' + wait, { ac: B.ac, ms: (wait + 15) * 1000 }); } catch (e) { a = null; }
      B.ac = null;
      if (!B.on || me !== B.loop) break;
      if (!a) {
        if (now() - t0 > 1500 && !lost) B.cuts++; else B.misses++;   // (cut short mid-wait: a proxy's; no answer at all: the relay)
        phaseSet(phaseNow());
        await sleep(B.misses >= 3 ? T.lostMs : 1000);
        continue;
      }
      if (a.status === 401 || a.status === 404) { B.pingOk = false; continue; }
      B.misses = 0;
      if (a.status === 200 && a.j && a.j.job) { B.cuts = 0; await runJob(a.j.job); B.idleSince = now(); await hello(true); continue; }
      if (a.status === 204) { B.waiting = +a.r.headers.get('X-Bench-Waiting') || 0; if (now() - t0 > (wait - 2) * 1000) B.cuts = 0; }
      else await sleep(2000);
      phaseSet(phaseNow());
    }
  }
  async function hello(force) {
    B.helloAt = now(); B.helloSig = B.phase + B.why + xrNow();
    void force;
    try { await call('/api/bench/hello', { body: { hs: B.hs, report: await report() }, ms: 10000 }); } catch (e) { /* asked again a minute on */ }
  }
  const send = (id, what, body) => call('/api/bench/jobs/' + id + '/' + what, { body, ms: 20000 });

  // ------------------------------------------------------------------ updates (SPEC 3, "Updates", "The plan after an update") --
  // a new shell asked about (HOST.live): taken while idle, the place kept; the page reloads, the session ends, bench mode
  // stays on and the page shows #benchEnter (without adb a person enters again; the jobs that need no session run meanwhile)
  async function takeShell() {
    const L = G(() => HOST.live.state(), null), q = L && L.ask;
    if (!q || !/^(shell|format|needs)$/.test(q.kind) || B.job || HOST.busy) return false;
    // (at most once in ten minutes, as HOST.live's own: a host that still serves the old files must not reload it in a loop)
    if (Date.now() - (+G(() => sessionStorage.getItem('liveReloadAt'), 0) || 0) < 600000) return false;
    await hello();
    G(() => HOST.live.reload('bench'));
    return true;
  }
  // after an update (HOST.live.sig: the shell's id, the packages' fingerprints) and 20 s idle with nothing queued for this
  // headset: the plan bench/plans/<benchPlan>.json, posted as a job (its page part as one of its own, first)
  async function autoPlan() {
    if (B.plan === 'none' || B.job || B.waiting || !B.idleSince || now() - B.idleSince < T.idle) return false;
    const s = G(() => HOST.live.sig(), null);
    if (!s || !s.shell) return false;
    const was = getJ('benchSig'), sig = JSON.stringify(s);
    if (!was) { put('benchSig', sig); return false; }
    if (JSON.stringify(was) === sig) return false;
    put('benchSig', sig);
    let plan = null;
    try { const r = await fetch('bench/plans/' + B.plan + '.json?t=' + Date.now(), { cache: 'no-store' }); if (r.ok) plan = await r.json(); } catch (e) { /* no plan file */ }
    if (!plan || !Array.isArray(plan.steps)) return false;
    // (never a script step in the plan a headset posts by itself: SPEC 14; the relay refuses one from 'auto' too)
    if ([...plan.steps, ...(Array.isArray(plan.page) ? plan.page : [])].some(x => x && x.cmd === 'script')) { B.auto = { at: Date.now(), status: 0, err: 'the plan ' + B.plan + ' holds a script step: refused' }; B.idleSince = now(); return false; }
    const why = 'update: ' + (was.shell !== s.shell ? 'shell ' + G(() => HOST.shell.n, '') : 'the packages changed');
    const base = Object.assign({}, plan, { from: 'auto', why, hs: B.hs });
    delete base.page;
    // (what the relay said is kept for the next report: a refusal, a full queue, is seen from the cloud's status)
    const said = r => { B.auto = { at: Date.now(), status: r ? r.status : 0, err: r && r.status >= 300 ? String((r.j && r.j.error) || '').slice(0, 120) : r ? '' : 'the relay did not answer' }; };
    if (Array.isArray(plan.page) && plan.page.length) said(await call('/api/bench/jobs', { body: Object.assign({}, base, { label: (plan.label || B.plan) + ' (page part)', need: 'page', steps: plan.page }) }).catch(() => null));
    said(await call('/api/bench/jobs', { body: base }).catch(() => null));
    B.idleSince = now();
    return true;
  }

  // ------------------------------------------------------------------ the report (SPEC 5.5) --
  async function battery() { try { if (!navigator.getBattery) return null; const b = await navigator.getBattery(); return Math.round(b.level * 100) + (b.charging ? '+' : ''); } catch (e) { return null; } }
  function where() {
    const A = app(), CH = A ? G(() => HOST.cur.peek('CH'), null) : null;
    let chapter = null;
    if (A && Array.isArray(CH)) CH.forEach((c, i) => { const a = +(c.na !== undefined ? c.na : c.a) || 0; if (A.t >= a - 0.01) chapter = i; });
    return { story: HOST.curKey || '', mode: HOST.picking || G(() => !!HOST.cur.peek("typeof XR !== 'undefined' && XR.on && XR.stories"), false) ? 'stories' : A ? A.mode : '', chapter, t: A ? r2(+A.t) : null, playing: A ? !!A.playing : null };
  }
  async function report() {
    const P = HOST.perfRun && HOST.perfRun.rec, I = P ? G(() => P.info(), {}) : {}, x = HOST.xr || {};
    const S = Object.assign({}, I.settings || {});
    for (const [k, fn] of [['labels', () => x.labels()], ['cards', () => x.cards()], ['free', () => x.free()], ['subs', () => !!x.mine('subs')], ['walk', () => x.walk()], ['sharp', () => x.sharp()], ['occlSmooth', () => HOST.occlusion.smooth()]]) { const v = G(fn, undefined); if (v !== undefined) S[k] = v; }
    let served = '';
    try { const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (r.ok) served = String((await r.json()).version || ''); } catch (e) { /* offline */ }
    const pk = {};
    for (const m of G(() => HOST.packages.all(), [])) if (m && m.key) pk[m.key] = m.fp;
    const errs = B.errs; B.errs = 0;
    return Object.assign({
      release: G(() => 'networks-v' + HOST.shell.n, ''), served, shell: G(() => ({ n: HOST.shell.n, id: HOST.shell.id }), null), packages: pk, loaded: Object.assign({}, HOST.fp || {}),
      device: I.device || '', model: I.model || '', browser: I.browser || '', ua: navigator.userAgent.slice(0, 200), xr: xrNow(),
      visibility: G(() => (HOST.session ? HOST.session.visibilityState : document.visibilityState), ''), hz: I.hz == null ? null : I.hz, hzList: I.hzList || '', eyeW: I.eyeW == null ? null : I.eyeW, eyeH: I.eyeH == null ? null : I.eyeH,
      fbScale: I.fbScale == null ? null : I.fbScale, fov: I.fov == null ? null : I.fov, battery: await battery(), settings: S,
    }, where(), { view: B.job && B.job.vw && B.job.vw.n ? viewOut(B.job.vw) : null, phase: B.phase, why: B.why, hs: B.hs, press: Object.assign({}, B.press), auto: B.auto || null, mods: G(() => HOST.mods.loaded(), []), errs, url: location.origin + location.pathname });
  }
  // (every error while bench mode is on is counted for the next report; a job's measure steps list them: perfrun.js)
  try { HOST.quietly(() => { window.addEventListener('error', () => { B.errs++; }); window.addEventListener('unhandledrejection', () => { B.errs++; }); }); } catch (e) { /* none */ }

  // ------------------------------------------------------------------ a job --
  class Stop extends Error {}
  // a step's promise against the job's stop (a cancel, a switch-off, a room), its own time limit and the job's
  function race(p, ms, J) {
    return new Promise((res, rej) => {
      let done = false;
      const end = (f, v) => { if (done) return; done = true; clearTimeout(t); clearInterval(iv); f(v); };
      const left = Math.max(1000, J.limit * 1000 - (Date.now() - J.t0));
      const lim = Math.min(ms, left), t = setTimeout(() => end(rej, new Error('timed out after ' + Math.round(lim / 1000) + ' s')), lim);
      const iv = setInterval(() => { if (J.stop) end(rej, new Stop(J.stop)); }, 100);
      Promise.resolve(p).then(v => end(res, v), e => end(rej, e));
    });
  }
  const until = async (fn, ms, why, J) => { const t0 = now(); for (;;) { if (J && J.stop) throw new Stop(J.stop); let v = false; try { v = fn(); } catch (e) { v = false; } if (v) return v; if (now() - t0 > ms) throw new Error(why || 'timed out after ' + Math.round(ms / 1000) + ' s'); await sleep(100); } };
  const cap = o => { const s = JSON.stringify(o === undefined ? null : o); return s.length <= OUTMAX ? JSON.parse(s) : { cut: true, bytes: s.length, head: s.slice(0, 2000) }; };
  async function runJob(job) {
    const J = B.job = { id: job.id, label: String(job.label || '').slice(0, 80), steps: job.steps || [], i: -1, of: (job.steps || []).length, cmd: '', stop: '', t0: Date.now(), limit: +job.limit || 300, sound: !!job.sound, picN: 0, need: job.need,
      vw: { mode: job.view === 'asis' ? 'asis' : 'fixed', applied: false, placed: false, lent: false, n: 0, why: '', real: null, head: null, rig: null, world: null } };
    const out = { hs: B.hs, ok: true, why: '', t0: J.t0, t1: 0, steps: [], report: null };
    const keep = () => put('benchJob', JSON.stringify({ id: J.id, step: Math.max(0, J.i), at: J.t0 }));
    keep();
    phaseSet('busy');
    // (the headset's menu closed: developer mode opens it on What is new as a session begins, and a picture would show it)
    if (HOST.session) G(() => HOST.collab.panelOpen && HOST.collab.menu && HOST.collab.panelOpen(false));
    const P = await HOST.mods.load('perfRun');
    const rec = P && P.rec;
    if (rec) rec.errors(true);
    // (the job's heartbeat: progress every 10 s; a cancel is learnt from its answer)
    const tell = async note => { try { const a = await send(J.id, 'progress', { hs: B.hs, step: J.i, of: J.of, note: note || J.cmd }); if (a.j && a.j.cancel) J.stop = 'cancelled'; } catch (e) { /* the next one */ } };
    const beat = setInterval(() => { if (!J.stop) tell(); }, 10000);
    const roomWatch = setInterval(() => { if (G(() => !!(HOST.collab && HOST.collab.code), false)) J.stop = 'a shared room was joined'; }, 250);
    try {
      out.report = await report();
      if (HOST.perfRun && HOST.perfRun.on && HOST.perfRun.on()) throw new Error('the performance run is on');
      if ((J.need === 'xr' || J.need === 'ar' || J.need === 'vr') && !HOST.session) throw new Error('needs a headset session');
      for (const [name, v] of Object.entries(job.with || {})) await borrow(name, v);
      for (let i = 0; i < J.of; i++) {
        const s = J.steps[i] || {};
        J.i = i; J.cmd = String(s.cmd || ''); keep(); bump();
        await tell(s.label || J.cmd);
        if (J.stop) throw new Stop(J.stop);
        const r = { i, cmd: J.cmd, ok: true, t0: Date.now(), t1: 0 };
        if (s.label) r.label = s.label;
        try {
          if (J.cmd === 'reload' && i !== J.of - 1) throw new Error('reload is a job\'s last step only');
          if (J.cmd === 'reload') { r.t1 = Date.now(); out.steps.push(r); J.reload = true; break; }
          J.tok = {};
          r.out = cap(await race(step(s, J, rec), limitOf(s), J));
          if (r.out && typeof r.out === 'object' && !Array.isArray(r.out) && /^(open|explore|seek)$/.test(J.cmd) && J.vw.n) r.out.view = viewOut(J.vw);
        } catch (e) {
          if (e instanceof Stop) { r.ok = false; r.err = e.message; out.steps.push(r); throw e; }
          r.ok = false; r.err = String(e && e.message || e).slice(0, 300);
        } finally {
          // (a probe or script that timed out may still be running: its api stops with the step, and its rays or
          // segment end here, not in the next step)
          J.tok = null; raysEnd(); segEnd(rec, 'the step ended');
        }
        r.t1 = Date.now();
        out.steps.push(r);
        if (!r.ok && !s.soft) { out.ok = false; out.why = r.err; break; }
      }
    } catch (e) {
      out.ok = false; out.why = String(e && e.message || e).slice(0, 300);
    } finally {
      clearInterval(beat); clearInterval(roomWatch);
      raysEnd();
      if (rec) { try { rec.close('the job ended'); } catch (e) { /* none open */ } rec.errors(false); }
      segOwn = null;
      B.picWant = null;
      out.view = J.vw.n ? viewOut(J.vw) : null;
      J.over = true;   // (a step that ran past its stop or time limit places no fixed view after this: viewPlace)
      await viewEnd(J).catch(() => {});
      if (giveBack() && !out.why) out.put = 'borrowed settings put back';
      out.t1 = Date.now();
      put('benchJob', null);
      B.job = null;
      phaseSet(B.on ? phaseNow() : 'off');
      await send(J.id, 'result', out).catch(() => {});
    }
    if (J.reload && B.on) setTimeout(() => G(() => HOST.live.reload('bench')), 300);
  }
  const limitOf = s => (s.cmd === 'script' && +s.limit > 0 ? Math.min(3600, +s.limit) * 1000 : 0) || ({ open: (s.scene ? 75 : 90) * 1000 + 30000, measure: (+s.sec || 1) * 3000 + 30000, rays: (+s.sec || 10) * 3000 + 30000, wait: s.until ? 65000 : (+s.sec || 0) * 1000 + 5000, pic: 15000, report: 20000 })[s.cmd] || 3600000;

  // ------------------------------------------------------------------ the commands (SPEC 5.2) --
  async function step(s, J, rec) {
    switch (s.cmd) {
      case 'report': return report();
      case 'open': { const o = s.scene ? await openScene(s, J) : await openStory(s.story, J); await viewPlace(J, true); return o; }
      case 'seek': {
        const A = need(app());
        const CH = G(() => HOST.cur.peek('CH'), null) || [];
        let t = +s.t;
        if (s.chapter !== undefined) { const c = CH[s.chapter]; if (!c) throw new Error('no such chapter: ' + s.chapter); t = (+(c.na !== undefined ? c.na : c.a) || 0) + 0.05; }
        if (A.mode !== 'story') A.enterStory(t); else A.seek(t);
        A.playing = !!s.play;
        await sleep(1000);
        await viewPlace(J, true);
        const w = where();
        return { mode: w.mode, chapter: w.chapter, t: w.t, playing: w.playing };
      }
      case 'play': case 'pause': {
        const A = need(app());
        if (s.cmd === 'play' && A.mode !== 'story') A.enterStory(+A.t || 0);
        A.playing = s.cmd === 'play';
        await sleep(200);
        return { t: r2(+A.t), playing: !!A.playing };
      }
      case 'explore': {
        const A = need(app());
        if (A.mode !== 'explore') A.enterExplore();
        await sleep(500);
        const tabs = G(() => [...document.querySelectorAll('#explore .tabs [data-tab]')].map(x => x.dataset.tab).filter(t => /^[\w-]{1,30}$/.test(t)), []);
        let tab = null;
        if (s.tab !== undefined) {
          tab = typeof s.tab === 'number' ? tabs[s.tab] : tabs.includes(s.tab) ? s.tab : undefined;
          if (tab === undefined) throw new Error('no such tab: ' + s.tab);
          // (a tab id the story's own panel lists, checked above: never the job's text as it came)
          if (!G(() => HOST.cur.peek("typeof showTab === 'function'"), false)) throw new Error('this story has no tabs to show');
          HOST.cur.peek('showTab(' + JSON.stringify(tab) + ')');
          await sleep(500);
        }
        await viewPlace(J, true);
        return { tabs, tab };
      }
      case 'set': return borrow(s.name, s.value);
      case 'measure': return measure(rec, +s.sec, s.name || '', J);
      case 'rays': return rays(s, J, rec);
      case 'pic': return pic(s, J);
      case 'probe': await viewKeep(J); return runProbe(s.name, s.args, J);
      case 'script': await viewKeep(J); return runProbe('', s.args, J, s.code);
      case 'wait':
        if (s.until === 'quiet') { const t0 = now(); await until(() => !HOST.busy, 60000, 'the app stayed busy', J); return { waited: r2((now() - t0) / 1000) }; }
        await sleep((+s.sec || 0) * 1000);
        return { waited: +s.sec || 0 };
      default: throw new Error('not a command: ' + String(s.cmd).slice(0, 20));
    }
  }
  function need(A) { if (!A) throw new Error('no story is open (open one first)'); return A; }
  const showStory = () => G(() => HOST.cur.peek("typeof XR !== 'undefined' && XR.on && XR.stories ? (XR.stories = false, XR.inStory = true, 1) : 0"), 0);
  async function openStory(key, J, hash) {
    if (!KEYRE.test(String(key)) || !HOST.meta(key)) throw new Error('no such story: ' + String(key).slice(0, 32));
    await until(() => !HOST.busy, 60000, 'the app stayed busy', J);
    const t0 = now(), was = HOST.curKey === key && HOST.cur && !hash;
    if (!was) {
      if (hash && HOST.curKey === key && HOST.cur) { HOST.hist.replace(hash); HOST.run(HOST.meta(key), true); }
      else HOST.start(key, hash);
      await sleep(50);
      await until(() => !HOST.busy && HOST.curKey === key && HOST.cur && G(() => HOST.loading.built(), false), (key === 'studio' ? 75 : 90) * 1000, (HOST.curKey === key ? 'did not load' : 'did not start') + ' within ' + (key === 'studio' ? 75 : 90) + ' s', J);
    }
    const n0 = B.frameN;
    await until(() => B.frameN > n0, 30000, 'no frame was drawn', J);
    showStory();
    const build = G(() => { const m = HOST.cur.peek('typeof LOAD !== "undefined" ? LOAD.ms : null'); return m && typeof m === 'object' ? Math.round(Object.values(m).reduce((a, b) => a + (Array.isArray(b) ? +b[1] || 0 : +b || 0), 0)) : null; }, null);
    return { key, load: was ? null : Math.round(now() - t0), build, was: !!was };
  }
  async function openScene(s, J) {
    const name = String(s.scene), src = s.src === 'relay' ? 'relay' : 'examples';
    if (!NAMERE.test(name)) throw new Error('no such scene: ' + name.slice(0, 40));
    const hash = '#studio' + (src === 'examples' ? '&scenes=examples' : '') + '&scene=' + encodeURIComponent(name);
    const o = await openStory('studio', J, hash);
    let calm = 0;
    await until(() => {
      const st = G(() => HOST.cur.peek('STUDIO.state()'), null);
      if (!st || st.scene !== name || st.listing !== 'ok') { calm = 0; return false; }
      const busy = Object.values(st.models || {}).some(m => m && (m.state === 'loading' || m.state === 'parsing'));
      calm = busy ? 0 : calm + 1;
      return calm >= 5;
    }, 75000, 'the scene ' + name + ' did not open within 75 s', J);
    return Object.assign(o, { scene: name, src });
  }

  // ---- measuring: perfrun.js's recorder (SPEC 6), and what the log lacks: lines, points, textures, geometries, programs
  // the recorder's segment this page opened last: a step closes only its own (one left by a probe that timed out is
  // not the next step's to lose)
  let segOwn = null;
  const segOpen = (rec, key) => (segOwn = rec.open('bench', HOST.curKey || '', key));
  const segClose = (rec, S, why) => { if (!S || segOwn !== S) return null; segOwn = null; return rec.close(why); };
  const segEnd = (rec, why) => { if (rec && segOwn) segClose(rec, segOwn, why); };
  async function measure(rec, sec, name, J) {
    if (!rec) throw new Error('the performance run\'s recorder did not load');
    await viewKeep(J);
    const S = segOpen(rec, name);
    const lim = sec * 3000 + 30000, t0 = now();
    try { await until(() => S.clk >= sec * 1000 || (now() - t0 > lim && (S.why = 'watchdog: frames stopped coming')), lim + 5000, '', J); } catch (e) { segClose(rec, S); throw e; }
    if (segOwn !== S) throw new Stop('the step ended');
    return extras(segClose(rec, S), J);
  }
  function extras(g, J) {
    if (!g) return g;
    if (J && J.vw && J.vw.n) g.view = viewOut(J.vw);   // (none on a page: nothing to place)
    const I = G(() => HOST.renderer.info, null);
    g.tex = I ? I.memory.textures : null; g.geo = I ? I.memory.geometries : null; g.prog = I && I.programs ? I.programs.length : null;
    return g;
  }

  // ---- pretend controller rays (SPEC 7): the hand's group written every frame after three.js's update, before the story's
  // frame, from a path in the head's frame at the step's start (its place and heading: a headset lying on a table points
  // anywhere, so its pitch and roll are left out)
  const SRCOF = (h, real) => ({ handedness: (real && real.handedness) || (h ? 'left' : 'right'), targetRayMode: 'tracked-pointer', profiles: ['bench'], bench: true,
    gamepad: { buttons: Array.from({ length: 6 }, () => ({ pressed: false, touched: false, value: 0 })), axes: [0, 0, 0, 0], hapticActuators: [] } });
  const D2R = Math.PI / 180;
  function pathFn(s) {
    const sec = +s.sec || 10, E = new THREE.Euler(), off = new THREE.Vector3(0.25, -0.3, -0.2);
    const turn = (yaw, pitch, q) => q.setFromEuler(E.set(pitch * D2R, yaw * D2R, 0, 'YXZ'));
    if (Array.isArray(s.path)) {
      const pts = s.path.map(p => {
        const P = new THREE.Vector3().fromArray(p.p), Q = new THREE.Quaternion();
        if (p.q) Q.fromArray(p.q).normalize();
        else { const M = new THREE.Matrix4().lookAt(P, new THREE.Vector3().fromArray(p.look), new THREE.Vector3(0, 1, 0)); Q.setFromRotationMatrix(M); }
        return { at: +p.at, P, Q };
      }).sort((a, b) => a.at - b.at);
      return (t, pos, q) => {
        let i = 0;
        while (i < pts.length - 1 && pts[i + 1].at <= t) i++;
        const a = pts[i], b = pts[Math.min(i + 1, pts.length - 1)], k = b.at > a.at ? Math.min(1, Math.max(0, (t - a.at) / (b.at - a.at))) : 0;
        pos.copy(a.P).lerp(b.P, k); q.copy(a.Q).slerp(b.Q, k);
      };
    }
    if (s.preset === 'circle') return (t, pos, q) => { const a = 2 * Math.PI * t / 4; pos.copy(off); turn(15 * Math.cos(a), 15 * Math.sin(a), q); };
    if (s.preset === 'still') return (t, pos, q) => { pos.copy(off); q.identity(); };
    // sweep: four rows, yaw -40 to 40 degrees and back, pitch from 15 down to -20
    return (t, pos, q) => {
      const u = Math.min(0.9999, Math.max(0, t / sec)) * 4, row = Math.floor(u), f = u - row, yaw = row % 2 ? 40 - 80 * f : -40 + 80 * f;
      pos.copy(off); turn(yaw, 15 - row * 35 / 3, q);
    };
  }
  async function rays(s, J, rec) {
    if (!HOST.session || !HOST.renderer) throw new Error('needs a headset session');
    await viewKeep(J);
    raysEnd();
    const hand = s.hand === 0 ? 0 : 1, sec = +s.sec || 10;
    const RY = B.rays = { hand, sec, fn: pathFn(s), press: (s.press || []).slice().sort((a, b) => a.at - b.at), pi: 0, t0: 0, H: null, frames: 0, hovers: 0, hoverOk: true, pressed: 0, src: null, real: null, g: null, done: null, err: '' };
    const fin = new Promise(r => { RY.done = r; });
    let seg = null, S = null;
    if (s.measure && rec) S = segOpen(rec, 'rays');
    try {
      await race(fin, sec * 3000 + 30000, J);
    } finally {
      raysEnd(RY);
      if (S) seg = extras(segClose(rec, S), J);
    }
    if (J.stop) throw new Stop(J.stop);
    if (RY.err) throw new Error(RY.err);
    const o = { frames: RY.frames, hovers: RY.hoverOk ? RY.hovers : null, pressed: RY.pressed, hand };
    if (seg) o.seg = seg;
    return o;
  }
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
  function pre(t, fr) {
    const RY = B.rays;
    if (!RY || !fr) return;
    try {
      const r = HOST.renderer, g = RY.g || (RY.g = r.xr.getController(RY.hand));
      if (!RY.H) {
        const vp = fr.getViewerPose(r.xr.getReferenceSpace());
        if (!vp) return;
        const m = new THREE.Matrix4().fromArray(vp.transform.matrix), hp = new THREE.Vector3().setFromMatrixPosition(m), fw = new THREE.Vector3(0, 0, -1).transformDirection(m);
        const yaw = Math.atan2(-fw.x, -fw.z);
        RY.H = new THREE.Matrix4().compose(hp, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), _s);
        RY.t0 = t;
        RY.real = G(() => HOST.session.inputSources[RY.hand], null) || null;
        RY.src = SRCOF(RY.hand, RY.real);
        if (RY.real) g.dispatchEvent({ type: 'disconnected', data: RY.real });
        g.dispatchEvent({ type: 'connected', data: RY.src });
      }
      const sec = (t - RY.t0) / 1000;
      RY.fn(Math.min(sec, RY.sec), _p, _q);
      _m.compose(_p, _q, _s).premultiply(RY.H);
      g.matrix.copy(_m); _m.decompose(g.position, g.quaternion, g.scale);
      if (g.parent) g.matrixWorld.multiplyMatrices(g.parent.matrixWorld, g.matrix); else g.matrixWorld.copy(g.matrix);
      g.visible = true;
      while (RY.pi < RY.press.length && RY.press[RY.pi].at <= sec) {
        const p = RY.press[RY.pi++], btn = RY.src.gamepad.buttons[0];
        if (p.down) { btn.pressed = true; btn.value = 1; g.dispatchEvent({ type: 'selectstart', data: RY.src }); RY.pressed++; }
        else { btn.pressed = false; btn.value = 0; g.dispatchEvent({ type: 'select', data: RY.src }); g.dispatchEvent({ type: 'selectend', data: RY.src }); }
      }
      RY.frames++;
      if (sec >= RY.sec) { const d = RY.done; RY.done = null; if (d) d(); }
    } catch (e) { RY.err = 'the pretend rays failed: ' + String(e && e.message || e).slice(0, 200); const d = RY.done; RY.done = null; if (d) d(); }
  }
  // the step's end (also on a throw, a cancel, a switch-off or the session's end): the pretend source disconnected, the real
  // one at that index connected again
  function raysEnd(own) {
    const RY = B.rays;
    if (!RY || (own && own !== RY)) return;
    B.rays = null;
    try {
      if (RY.g && RY.src) {
        const sb = RY.src.gamepad.buttons[0];
        if (sb.pressed) RY.g.dispatchEvent({ type: 'selectend', data: RY.src });
        RY.g.dispatchEvent({ type: 'disconnected', data: RY.src });
        const real = G(() => HOST.session.inputSources[RY.hand], null);
        if (real) RY.g.dispatchEvent({ type: 'connected', data: real });
      }
    } catch (e) { /* the session went meanwhile */ }
    if (RY.done) { const d = RY.done; RY.done = null; d(); }
  }
  // after the story's frame: the frames counted, the pretend ray's hover read (its dot: two fixed expressions), a picture taken
  const DOT = ['XR.ctrls[0].dot.visible', 'XR.ctrls[1].dot.visible'];
  function post(t, fr) {
    B.frameN++;
    const RY = B.rays;
    if (RY && RY.H && RY.hoverOk) { try { if (HOST.cur.peek(DOT[RY.hand])) RY.hovers++; } catch (e) { RY.hoverOk = false; } }
    if (B.picWant && (fr || !HOST.session)) grabNow(fr);   // (in a session, a session frame: never the page canvas)
    if (B.viewAsk && fr) { const a = B.viewAsk; B.viewAsk = null; a(fr); }   // (a session frame only)
  }

  // ---- the fixed view (SPEC 15, v233): the story at one place in front of the eyes, however the headset lies
  // the job's view (J.vw): mode 'fixed' (the default) or 'asis'; applied: the shell's fixed view holds; placed: the story was
  // recentred in it this job; lent: the anchor lent (HOST.anchor.pause); n: placements; real: how the headset really lay at
  // the last one (three.js's own space: y its height, yaw, pitch, roll in degrees); head: the head as the story has it;
  // rig: the story's frame (GL.rig) from the head (d m, bearing and elev degrees, yaw its turn): the same run to run
  const D = v => Math.round(v * 10) / 10, CM = v => Math.round(v * 100) / 100;
  const frames = (n, J) => { const n0 = B.frameN; return until(() => B.frameN >= n0 + n, 5000, 'no frame was drawn', J); };
  // after the next story frame: the head where the story has it, and its rig from the head (one fixed expression)
  function viewNums() {
    return new Promise(res => {
      const t = setTimeout(() => { if (B.viewAsk === ask) B.viewAsk = null; res(null); }, 3000);
      const ask = B.viewAsk = fr => {
        clearTimeout(t);
        try {
          const r = HOST.renderer, vp = fr && r ? fr.getViewerPose(r.xr.getReferenceSpace()) : null;
          if (!vp) { res(null); return; }
          const H = new THREE.Matrix4().fromArray(vp.transform.matrix), hp = new THREE.Vector3().setFromMatrixPosition(H);
          const e = new THREE.Euler().setFromRotationMatrix(H, 'YXZ');
          const o = { head: { y: CM(hp.y), yaw: D(e.y / D2R), pitch: D(e.x / D2R), roll: D(e.z / D2R) }, rig: null, world: null };
          // (the story's frame, GL.rig, and its scene's root, GL.world: every story has both; seen from the head)
          const from = name => {
            const m = G(() => HOST.cur.peek(name === 'rig' ? 'Array.from(GL.rig.matrixWorld.elements)' : 'Array.from(GL.world.matrixWorld.elements)'), null);
            if (!Array.isArray(m) || m.length !== 16 || !m.every(Number.isFinite)) return null;
            const rel = H.clone().invert().multiply(new THREE.Matrix4().fromArray(m)), p = new THREE.Vector3().setFromMatrixPosition(rel), hz = Math.hypot(p.x, p.z);
            const fw = new THREE.Vector3(0, 0, -1).transformDirection(rel);
            const o = { d: CM(p.length()), bearing: hz < 0.01 ? 0 : D(Math.atan2(p.x, -p.z) / D2R), elev: p.length() < 0.01 ? 0 : D(Math.atan2(p.y, hz) / D2R), s: CM(new THREE.Vector3().setFromMatrixColumn(rel, 0).length()) };
            // (the frame's turn; not the scene's: an explore view spins its scene by itself)
            if (name === 'rig') o.yaw = D(Math.atan2(-fw.x, -fw.z) / D2R);
            return o;
          };
          o.rig = from('rig'); o.world = from('world');
          res(o);
        } catch (e) { res(null); }
      };
    });
  }
  // placed (open, explore, seek; and the job's first measuring step): the shell's fixed view from the head's real pose now,
  // the anchor lent, the story recentred in it; 'asis' only reads the numbers. A page (no session): nothing
  // (a step the job left behind, stopped or timed out and still running, never moves the room or lends the anchor once
  // the job has ended or is ending: viewEnd lets go only once)
  const viewGone = J => !!(J.stop || J.over || B.job !== J);
  async function viewPlace(J, again) {
    const V = J.vw;
    if (!V) return null;
    if (viewGone(J)) throw new Stop(J.stop || 'the job has ended');
    if (!HOST.session || !HOST.renderer) { V.why = 'no headset session'; return null; }
    if (V.mode === 'fixed') {
      if (!HOST.xr || !HOST.xr.benchView) { V.why = 'this shell has no fixed view'; V.applied = false; }
      else {
        if (!V.lent && HOST.anchor && HOST.anchor.pause) { HOST.anchor.pause(true); V.lent = true; }
        const a = await HOST.xr.benchView(true);
        if (viewGone(J)) {
          // (the job stopped or ended while the shell placed it: let go again; the anchor was lent before, so viewEnd gives it back)
          if (a && a.real) await HOST.xr.benchView(false);
          throw new Stop(J.stop || 'the job has ended');
        }
        if (a && a.real) { V.applied = true; V.real = a.real; V.why = ''; }
        else { V.applied = false; V.why = 'the fixed view failed: ' + String((a && a.err) || 'no answer').slice(0, 80); }
      }
    }
    if (V.mode === 'fixed' && (again || !V.placed)) {
      // (Recenter, as the menu's: the story puts its frame in front of the head three.js now has; the anchor lent, so
      // Place again does nothing. 'asis' never recentres: the story stays where the headset left it, as before v233)
      G(() => HOST.cur.recenter && HOST.cur.recenter());
      V.placed = true;
      await frames(3, J);
    } else await frames(2, J);
    const o = await viewNums();
    V.n++;
    if (o) { V.head = o.head; V.rig = o.rig; V.world = o.world; }
    if (V.mode !== 'fixed' && o) V.real = { y: o.head.y, yaw: o.head.yaw, pitch: o.head.pitch, roll: o.head.roll };
    return viewOut(V);
  }
  // before each measure, rays, pic, probe and script: placed again from where the head lies now (no recentre once placed:
  // the story stays where it is in the carried room), so a headset that slid keeps the same view; never inside a segment
  const viewKeep = J => (J && J.vw && HOST.session ? viewPlace(J, false) : Promise.resolve(null));
  // what a step, a segment and the result record
  function viewOut(V) {
    if (!V) return null;
    const r = V.real, o = { mode: V.mode, applied: !!V.applied };
    if (r) { o.y = CM(r.y); o.pitch = D(r.pitch); o.roll = D(r.roll); o.yaw = D(r.yaw); }
    if (V.rig) o.rig = Object.assign({}, V.rig);
    if (V.world) o.world = Object.assign({}, V.world);
    if (V.head) o.head = Object.assign({}, V.head);
    if (V.why) o.why = V.why;
    return o;
  }
  // the job's end: the fixed view let go, the story recentred in front of the real head (the anchor's saved arrangement
  // with it, as a session starts), then the anchor given back and holding again
  async function viewEnd(J) {
    const V = J.vw;
    if (!V || (!V.applied && !V.lent && !(HOST.xr && HOST.xr.benchViewOn && HOST.xr.benchViewOn()))) return;
    if (HOST.xr && HOST.xr.benchView) await HOST.xr.benchView(false);
    if (V.lent && HOST.anchor && HOST.anchor.pause) HOST.anchor.pause('saved');
    try {
      if (HOST.session && V.placed) {
        const n0 = B.frameN;
        await until(() => B.frameN >= n0 + 1, 2000, '');
        G(() => HOST.cur.recenter && HOST.cur.recenter());
        const n1 = B.frameN;
        await until(() => B.frameN >= n1 + 3, 2000, '');
      }
    } catch (e) { /* no frames: the session went */ } finally {
      if (V.lent && HOST.anchor && HOST.anchor.pause) HOST.anchor.pause(false);
      V.lent = false; V.applied = false;
    }
  }

  // ---- the left eye's picture (SPEC 1.7): the notebook's read-back of the layer's framebuffer right after the story's frame
  // (on a page, the canvas likewise); never the passthrough camera
  function grabNow(fr) {
    const W = B.picWant, N = HOST.notes;
    if (!N || !N.grab) { B.picWant = null; W.res({ err: 'no picture: the notebook did not load' }); return; }
    if (fr && HOST.xr && HOST.xr.sharpPause && !HOST.xr.sharpPause() && now() - W.at < 2500) return;   // (Sharp text: its panels drawn into the eye buffer for a frame first)
    B.picWant = null;
    let cv = null;
    try { cv = N.grab(W.w); } catch (e) { W.res({ err: 'no picture: ' + String(e && e.message || e) }); return; }
    W.res({ cv });
  }
  async function pic(s, J) {
    if (!HOST.notes || !HOST.notes.grab) await HOST.mods.load('notes');
    if (J.picN >= 20) throw new Error('no picture: at most 20 a job');
    await viewKeep(J);
    const w = Math.round(Math.min(1280, Math.max(320, +s.w || 960))), q = Math.min(0.92, Math.max(0.5, +s.q || 0.8));
    const got = await new Promise(res => {
      B.picWant = { w, at: now(), res };
      setTimeout(() => { if (B.picWant && B.picWant.res === res) { B.picWant = null; res({ err: 'no picture: no frame was drawn' }); } }, 5000);
    });
    if (got.err) throw new Error(got.err);
    const cv = got.cv;
    let blob = null;
    for (let k = q; k >= 0.3 && (!blob || blob.size > 1000000); k -= 0.15) blob = await new Promise(r => cv.toBlob(b => r(b), 'image/jpeg', k));
    if (!blob || blob.size > 1000000) throw new Error('no picture: it would not fit in 1 MB');
    const n = ++J.picN;
    const R = await relay();
    const r = await fetch(R.base + '/api/bench/jobs/' + J.id + '/pic?n=' + n, { method: 'POST', cache: 'no-store', headers: Object.assign({ 'Content-Type': 'image/jpeg' }, R.token ? { Authorization: 'Bearer ' + R.token } : {}), body: blob });
    if (!r.ok) throw new Error('no picture: the relay answered ' + r.status);
    const o = { n, w: cv.width, h: cv.height, bytes: blob.size, xr: xrNow() };
    if (J.vw && J.vw.n) o.view = viewOut(J.vw);
    return o;
  }

  // ---- probes (SPEC 10): bench/probes/<name>.js from this origin, loaded fresh once a page, refused when it names another
  function probe(name, fn) {
    if (name !== B.loading || typeof fn !== 'function') { console.warn('A bench probe named ' + String(name).slice(0, 32) + ' was refused: not the file being loaded'); return false; }
    B.probes[name] = fn;
    return true;
  }
  function loadProbe(name) {
    if (B.probes[name]) return Promise.resolve(B.probes[name]);
    return new Promise((res, rej) => {
      B.loading = name;
      const sc = document.createElement('script');
      sc.src = 'bench/probes/' + name + '.js?t=' + Date.now();
      sc.onload = () => { sc.remove(); B.loading = ''; if (B.probes[name]) res(B.probes[name]); else rej(new Error('no such probe')); };
      sc.onerror = () => { sc.remove(); B.loading = ''; rej(new Error('no such probe')); };
      HOST.quietly(() => document.head.appendChild(sc));
    });
  }
  // a script step's code (SPEC 14): compiled as the body of an async function (api, args), only when this page may run it;
  // asked of the relay afresh, as the job came from it
  const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
  async function scriptFn(code) {
    if (!B.on) throw new Error('bench mode is off');
    const h = heldWhy();
    if (h) throw new Error('no scripts here: ' + h);
    if (typeof code !== 'string' || !code.trim() || code.length > 65536) throw new Error('the script is empty or over 64 KB');
    let a = null;
    try { a = await call('/api/ping', { ms: 8000 }); } catch (e) { a = null; }
    B.scripts = !!(a && a.j && a.j.bench && a.j.benchScripts);
    if (!B.scripts) throw new Error('scripts are off at this relay (it was not started with --bench-scripts)');
    try { return new AsyncFn('api', 'args', code); } catch (e) { throw new Error('the script does not compile: ' + String(e && e.message || e).slice(0, 200)); }
  }
  // a probe by name, or (code given) a script step's code: the same api, limits and error handling for both
  async function runProbe(name, args, J, code) {
    const what = code === undefined ? 'probe' : 'script';
    if (what === 'probe' && !KEYRE.test(String(name))) throw new Error('no such probe');
    const fn = what === 'probe' ? await loadProbe(name) : await scriptFn(code), lines = [];
    const copy = () => JSON.parse(JSON.stringify(args === undefined ? null : args));
    const rec = HOST.perfRun && HOST.perfRun.rec;
    // (the api's view of the job: stopped with the job, and also once this step is over, as when the step timed out and
    // the script still runs; a call then throws instead of starting rays or a measure under the next step)
    const tok = J.tok, V = Object.create(J, { stop: { get: () => J.stop || (J.tok !== tok || B.job !== J ? 'the step ended' : '') } });
    const go = f => async (...a) => { if (V.stop) throw new Stop(V.stop); return f(...a); };
    const api = Object.freeze({
      args: copy(), story: () => HOST.curKey || '', app: () => { const w = where(); return { mode: w.mode, t: w.t, playing: w.playing, chapter: w.chapter }; },
      peek: expr => HOST.cur.peek(expr), frames: go(n => { const n0 = B.frameN; return until(() => B.frameN >= n0 + Math.max(1, +n || 1), 60000, 'no frames came', V); }),
      wait: go(async ms => { await sleep(Math.max(0, Math.min(600000, +ms || 0))); if (V.stop) throw new Stop(V.stop); }), until: go((f, ms) => until(f, Math.min(600000, +ms || 10000), 'the probe\'s wait timed out', V)),
      measure: go(sec => measure(rec, Math.min(600, Math.max(1, +sec || 1)), 'probe', V)),
      rays: go(o => rays(Object.assign({ sec: 10, preset: 'sweep' }, o && typeof o === 'object' ? { hand: o.hand === 0 ? 0 : 1, sec: Math.min(600, Math.max(0.5, +o.sec || 10)), preset: ['sweep', 'circle', 'still'].includes(o.preset) ? o.preset : 'sweep', measure: !!o.measure } : {}), V, rec)),
      renderer: () => { const I = HOST.renderer && HOST.renderer.info; return I ? { info: { render: Object.assign({}, I.render), memory: Object.assign({}, I.memory), programs: I.programs ? I.programs.length : 0 } } : null; },
      session: () => xrNow(),
      log: t => { if (lines.length < 50) lines.push(String(t).slice(0, 300)); },
    });
    let v;
    try { v = await fn(api, copy()); } catch (e) { if (e instanceof Stop) throw e; throw new Error('the ' + what + ' threw: ' + String(e && e.message || e).slice(0, 200)); }
    const o = v && typeof v === 'object' && !Array.isArray(v) ? Object.assign({}, v) : { value: v === undefined ? null : v };
    if (lines.length) o.log = lines;
    return o;
  }

  // ------------------------------------------------------------------ #benchEnter: Enter AR or VR within the press --
  function enter(ev) {
    const P = B.press;
    P.n++; P.trusted = !!(ev && ev.isTrusted); P.at = Date.now(); P.err = '';
    const mode = B.want === 'vr' ? 'immersive-vr' : 'immersive-ar', t0 = Date.now();
    if (!navigator.xr) { P.err = 'this browser has no WebXR'; bump(); return; }
    const b = document.getElementById(B.want === 'vr' ? 'btnVR' : 'btnAR');
    if (b) b.click(); else { P.err = 'no Enter ' + B.want.toUpperCase() + ' button on this page'; bump(); return; }
    // (the session request's refusal, as HOST.xr.request saw it: index.html)
    let k = 0;
    const iv = setInterval(() => {
      const e = G(() => HOST.xr.reqErr(), null);
      if (e && e.at >= t0 && e.mode === mode) { P.err = e.msg; clearInterval(iv); bump(); }
      else if (HOST.session || ++k > 100) { clearInterval(iv); bump(); }
    }, 100);
    bump();
  }

  // ------------------------------------------------------------------ what shows --
  // one line (the bar on a page; shared.js draws it in the headset, 26 degrees under the gaze, changed only between steps)
  function line() {
    if (!B.on) return '';
    if (B.phase === 'held') return 'Bench mode is on but waiting: ' + B.why + '. Switch off: menu, Debug.';
    if (B.phase === 'busy' && B.job) return 'Bench: ' + (B.job.label || 'a job') + ', step ' + (Math.max(0, B.job.i) + 1) + ' of ' + B.job.of + ' (' + (B.job.cmd || '...') + '). Switch off: menu, Debug.';
    if (B.phase === 'lost') return 'Bench: the relay does not answer; trying again.';
    if (B.phase === 'enter') return 'Bench mode is on (' + B.hs + '): waiting for the headset view. Switch off: menu, Debug, Bench mode.';
    return 'Bench mode is on (' + B.hs + '): the cloud may run tests here. Switch off: menu, Debug, Bench mode.';
  }
  const UI = { bar: null, card: null, sig: -1 };
  function build() {
    if (UI.bar) return;
    HOST.quietly(() => {
      const st = document.createElement('style');
      st.textContent = `#benchBar { position: fixed; left: 0; right: 0; top: 0; z-index: 60; display: flex; align-items: center; gap: 10px; padding: 6px 16px; min-height: 30px; box-sizing: border-box; background: #4a2a00; color: #ffe2b0; font: 13px/1.3 B612, system-ui, sans-serif; border-bottom: 2px solid #ffb43b; }
#benchBar span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
#benchBar button, #benchCard button { font: inherit; border-radius: 6px; border: 1px solid #ffb43b; background: #10223a; color: #fff; padding: 4px 12px; cursor: pointer; }
#benchCard { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 60; width: min(420px, calc(100vw - 32px)); box-sizing: border-box; padding: 14px 16px; border-radius: 12px; background: rgba(8,15,28,0.95); border: 2px solid #ffb43b; color: #e8eefc; font: 14px/1.4 B612, system-ui, sans-serif; text-align: center; }
#benchCard p { margin: 0 0 10px; }
#benchCard #benchEnter { font-size: 18px; padding: 10px 22px; background: #ffb43b; color: #10223a; font-weight: bold; }`;
      document.head.appendChild(st);
      const bar = UI.bar = document.createElement('div');
      bar.id = 'benchBar'; bar.hidden = true; bar.setAttribute('role', 'status');
      bar.innerHTML = '<span></span><button id="benchOff" type="button">Switch off</button>';
      bar.querySelector('#benchOff').addEventListener('click', () => set(false, 'bench mode was switched off'));
      const card = UI.card = document.createElement('div');
      card.id = 'benchCard'; card.hidden = true;
      card.innerHTML = '<p>Bench mode is waiting for the headset view</p><button id="benchEnter" type="button">Enter AR</button>';
      card.querySelector('#benchEnter').addEventListener('click', ev => enter(ev));
      document.body.appendChild(bar); document.body.appendChild(card);
    });
  }
  function paint() {
    if (!B.on && !UI.bar) return;
    build();
    if (UI.sig === B.sig) return;
    UI.sig = B.sig;
    UI.bar.hidden = !B.on;
    UI.bar.querySelector('span').textContent = line();
    UI.card.hidden = !(B.on && B.phase === 'enter' && !HOST.session);
    UI.card.querySelector('#benchEnter').textContent = B.want === 'vr' ? 'Enter VR' : 'Enter AR';
  }
  // (a second's tick: twelve hours, developer mode, the session's start and end; a timer, as a headset's page frames stop)
  let lastXr = '';
  setInterval(() => {
    if (B.on && (Date.now() > B.until || !devOn())) { set(false, !devOn() ? 'developer mode was switched off' : 'twelve hours passed'); return; }
    if (B.on && xrNow() !== lastXr) { lastXr = xrNow(); if (!B.job && B.phase !== 'held') phaseSet(phaseNow()); bump(); }
    if (!HOST.session && B.rays) { B.rays.err = 'the headset view ended'; raysEnd(); }
  }, 1000);

  // ------------------------------------------------------------------ the boot --
  // #bench=on|off (with #dev=on before it), benchxr=ar|vr, benchplan=<name>|none; or bench mode kept from before a reload
  function boot(hp) {
    if (hp && hp.has('benchxr')) { const v = hp.get('benchxr') === 'vr' ? 'vr' : 'ar'; B.want = v; put('benchXr', v); }
    if (hp && hp.has('benchplan')) { const v = hp.get('benchplan'); if (v === 'none' || KEYRE.test(v)) { B.plan = v; put('benchPlan', v); } }
    if (hp && hp.has('bench')) { set(hp.get('bench') !== 'off', 'bench mode was switched off'); return; }
    const k = getJ('benchOn');
    if (k && +k.until > Date.now()) { if (devOn() && set(true)) { B.until = +k.until; put('benchOn', JSON.stringify({ until: B.until })); } }
    else if (k) put('benchOn', null);
  }
  // (the perfrun module's recorder: its error catching is installed as it loads)
  if (HOST.mods) HOST.mods.load('perfRun');

  return {
    boot, set, probe, pre, post, line,
    on: () => B.on,
    // the shell's holds while a job runs (index.html): no slideshow stop, no Repeat, no live swap or reload; sound quiet
    // unless the job says sound
    hold: () => !!B.job, hush: () => !!(B.job && !B.job.sound),
    // fixed for the adb helper (SPEC 9.1)
    state: () => ({ on: B.on, phase: B.phase, why: B.why, hs: B.hs, xr: xrNow(), want: B.want, job: B.job ? { id: B.job.id, step: B.job.i, of: B.job.of } : null, press: Object.assign({}, B.press), rel: G(() => 'networks-v' + HOST.shell.n, ''), url: location.origin + location.pathname, now: Date.now() }),
    sig: () => B.sig + ':' + B.phase,
    settings: () => Object.keys(SET),
    // (tests: shorter waits)
    test(o) { if (o && typeof o === 'object') for (const k of Object.keys(T)) if (o[k] > 0) T[k] = +o[k]; return Object.assign({}, T); },
  };
});

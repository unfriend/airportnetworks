// The developer notebook (HOST.notes, v142; the owner, 13 November 2026: "a developer notebook function where i can
// directly record some spoken audio in ar or vr and then it gets transcribed somehow ... and i can also attach a
// screenshot if needed with things highlighted and then i can use the output to tell you about bugs etc, the more direct
// the better"; then "holding y or b to record, primarly i will use it from within ar or vr but sometimes i might record a
// quick note from my phone or laptop"). tools/notes/SPEC.md is the contract. Developer mode only (HOST.dev.on()): a note is
// a voice recording with two pictures (as it began and as it ended), pins (where the person pressed while talking, and what
// was there) and the context (what the app knew), sent to the relay's /api/notes and kept in an outbox (IndexedDB) until a
// relay answers. In a headset B or Y held for 0.45 s records (shared.js's sticks calls hold(), its selectstart listener
// pin()); on a page a round button does. The shell's sound rule holds: no AudioContext of its own (the level meter is an
// analyser on HOST.audio.fx()'s, connected to nothing else). Nothing of a note is in a room's keys or collab.state().
// shared.js links itself in at its end (link): the relay, notices, sounds, the log, the room, and what a controller's press
// hit. It also draws the read-out and the pins (view()).
HOST.notes = (function () {
  'use strict';
  const NOTE = { max: 300, holdMs: 450, micKeep: 60000, shotW: 1280, outMax: 20, bytes: 16 * 1024 * 1024, pinsHeadset: 10000, pinsPage: 4000 };
  let L = {};   // what shared.js gives (link)
  const T = { clock: null, noMic: false };   // for tests
  const clock = () => (T.clock ? T.clock() : performance.now());
  const N = { rec: false, how: '', kind: '', t0: 0, at: 0, pins: [], src: null, shots: [null, null], want: '', busy: 0, sent: 0, last: { id: '', err: '' }, pinsUntil: 0,
    outN: 0, strip: '', level: 0, sess: false, endP: null, cancel: false, rel: '' };
  const M = { stream: null, mr: null, type: '', chunks: [], state: 'off', timer: 0, an: null, src: null, buf: null, ctx: null, off: 0, err: '', blob: null, done: null };
  const quiet = fn => { const q = HOST.quiet; HOST.quiet = true; try { return fn(); } finally { HOST.quiet = q; } };
  const devOn = () => !!(HOST.dev && HOST.dev.on && HOST.dev.on());
  const G = (fn, d) => { try { const v = fn(); return v === undefined ? d : v; } catch (e) { return d; } };
  const log = (e, o) => { try { if (L.log) L.log(e, o); } catch (x) { /* no log */ } };
  const mmss = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const clean = s => String(s || '').replace(/([?&#])(token|key|password)=[^&#]*/gi, '$1$2=').replace(/(Bearer\s+)\S+/gi, '$1');
  const notice = (t, x, ms) => { if (L.notice) try { L.notice(t, x, ms); } catch (e) { /* no notice */ } };
  const inSession = () => !!HOST.session;

  // ------------------------------------------------------------------ the outbox (IndexedDB, at most 20 notes) --
  const DB = { p: null, mem: [] };
  function db() {
    if (DB.p) return DB.p;
    DB.p = new Promise(res => {
      try {
        const r = indexedDB.open('networks-notes', 1);
        r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('outbox')) r.result.createObjectStore('outbox', { keyPath: 'k', autoIncrement: true }); };
        r.onsuccess = () => res(r.result);
        r.onerror = () => res(null);
        r.onblocked = () => res(null);
      } catch (e) { res(null); }
    });
    return DB.p;
  }
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function outAll() {
    const d = await db();
    if (!d) return DB.mem.slice();
    try { return await req(d.transaction('outbox').objectStore('outbox').getAll()); } catch (e) { return DB.mem.slice(); }
  }
  async function outAdd(note) {
    const d = await db();
    if (!d) { DB.mem.push({ k: Date.now() + Math.random(), note }); while (DB.mem.length > NOTE.outMax) DB.mem.shift(); return; }
    try {
      const st = d.transaction('outbox', 'readwrite').objectStore('outbox');
      await req(st.add({ note, at: Date.now() }));
      const all = await req(st.getAllKeys());
      for (const k of all.slice(0, Math.max(0, all.length - NOTE.outMax))) await req(d.transaction('outbox', 'readwrite').objectStore('outbox').delete(k));
    } catch (e) { DB.mem.push({ k: Date.now() + Math.random(), note }); while (DB.mem.length > NOTE.outMax) DB.mem.shift(); }
  }
  async function outDel(k) {
    DB.mem = DB.mem.filter(x => x.k !== k);
    const d = await db();
    if (d) try { await req(d.transaction('outbox', 'readwrite').objectStore('outbox').delete(k)); } catch (e) { /* gone */ }
  }
  async function outCount() {
    const d = await db();
    if (!d) { N.outN = DB.mem.length; return N.outN; }
    try { N.outN = await req(d.transaction('outbox').objectStore('outbox').count()); } catch (e) { N.outN = DB.mem.length; }
    return N.outN;
  }

  // ------------------------------------------------------------------ the relay --
  async function post(note) {
    const r = L.relayFind ? await L.relayFind() : null;
    if (!r || !r.base) return { ok: false, err: 'no relay' };
    const body = JSON.stringify(note);
    if (body.length > NOTE.bytes) return { ok: false, err: 'too big', drop: true };
    const ab = new AbortController(), to = setTimeout(() => ab.abort(), 90000);
    try {
      const res = await fetch(r.base + '/api/notes', { method: 'POST', cache: 'no-store', signal: ab.signal,
        headers: Object.assign({ 'Content-Type': 'application/json' }, r.token ? { Authorization: 'Bearer ' + r.token } : {}), body });
      let j = null;
      try { j = await res.json(); } catch (e) { /* not JSON */ }
      try { if (L.relaySaw) L.relaySaw(r.base, res.status, r.token || '', j); } catch (e) { /* no prompt */ }
      if ((res.status === 201 || res.status === 200) && j && j.id) return { ok: true, id: j.id };   // (200: the relay had this note already, by its nonce)
      return { ok: false, err: 'the relay answered ' + res.status + (j && j.error ? ': ' + j.error : ''), drop: res.status === 400 || res.status === 413 };
    } catch (e) { return { ok: false, err: navigator.onLine === false ? 'offline' : 'the relay could not be reached' }; }
    finally { clearTimeout(to); }
  }
  const sum = n => mmss(n.dur) + ', ' + n.pins.length + (n.pins.length === 1 ? ' pin' : ' pins');
  async function deliver(note) {
    const r = await post(note);
    if (r.ok) { N.sent++; N.last = { id: r.id, err: '' }; log('note sent', { id: r.id, dur: note.dur, pins: note.pins.length }); notice('Note sent (' + sum(note) + ')', '', 2500); strip('Note sent (' + sum(note) + ').'); return true; }
    N.last = { id: '', err: r.err };
    log('note not sent', { err: r.err });
    if (r.drop) { notice('Note not sent', 'The relay refused it: ' + r.err + '.', 5000); strip('The note was not sent: ' + r.err + '.'); return false; }
    await outAdd(note); await outCount();
    notice('Note kept on this device', 'It goes once a relay answers.', 4500);
    strip('Note kept on this device: it goes once a relay answers.');
    return false;
  }
  let flushing = false;
  async function flush() {
    if (flushing || !devOnOrKept()) return;
    flushing = true;
    try {
      for (const e of await outAll()) {
        const r = await post(e.note);
        if (r.ok) { await outDel(e.k); N.sent++; N.last = { id: r.id, err: '' }; log('note sent from outbox', { id: r.id }); notice('Note sent (' + sum(e.note) + ')', '', 2500); strip('Note sent (' + sum(e.note) + ').'); }
        else if (r.drop) {   // (refused for good: dropped, but said)
          await outDel(e.k); log('note dropped from outbox', { err: r.err });
          notice('A kept note was not sent', 'The relay refused it: ' + r.err + '.', 5000); strip('A kept note was not sent: ' + r.err + '.');
        } else break;
      }
    } catch (e) { /* the next try */ }
    flushing = false;
    await outCount();
  }
  // a note kept earlier goes even with developer mode off since (it was made with it on; nothing new is recorded)
  const devOnOrKept = () => true;

  // ------------------------------------------------------------------ the microphone --
  const micThere = () => !T.noMic && typeof MediaRecorder !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  function micLive() { return !!(M.stream && M.stream.getAudioTracks().some(t => t.readyState === 'live')); }
  function micAsk(ms) {
    if (micLive()) { clearTimeout(M.timer); return Promise.resolve(M.stream); }
    if (!M.pending) {   // (one request at a time: one that is slow is waited for again, never asked twice)
      const p = M.pending = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(s => { M.pending = null; M.stream = s; return s; }, e => { M.pending = null; throw e; });
      p.then(() => { if (!N.rec) micKeepOpen(); }, () => {});   // (it came after all: kept for the next note)
    }
    const p = M.pending;
    return new Promise((res, rej) => {
      const to = setTimeout(() => rej(Object.assign(new Error('no answer'), { name: 'Timeout' })), ms);
      p.then(s => { clearTimeout(to); res(s); }, e => { clearTimeout(to); rej(e); });
    });
  }
  function micClose() {
    clearTimeout(M.timer); M.timer = 0;
    meterOff();
    if (M.stream) for (const t of M.stream.getTracks()) { try { t.stop(); } catch (e) { /* gone */ } }
    M.stream = null;
  }
  // open for 60 s after the last note, so the next starts at once
  function micKeepOpen() { clearTimeout(M.timer); M.timer = setTimeout(() => { if (!N.rec) micClose(); }, NOTE.micKeep); }
  function meterOn() {
    meterOff();
    try {
      const ctx = HOST.audio && HOST.audio.fx && HOST.audio.fx();
      if (!ctx || !M.stream) return;
      M.src = ctx.createMediaStreamSource(M.stream); M.an = ctx.createAnalyser(); M.an.fftSize = 512; M.buf = new Uint8Array(M.an.fftSize); M.ctx = ctx;
      M.src.connect(M.an);   // (connected to nothing else: no sound out)
    } catch (e) { meterOff(); }
  }
  function meterOff() {
    try { if (M.src) M.src.disconnect(); } catch (e) { /* gone */ }
    M.src = M.an = M.buf = M.ctx = null; N.level = 0;
  }
  function level() {
    if (!M.an) return 0;
    try { M.an.getByteTimeDomainData(M.buf); let s = 0; for (let i = 0; i < M.buf.length; i++) { const v = (M.buf[i] - 128) / 128; s += v * v; } N.level = Math.min(1, Math.sqrt(s / M.buf.length) * 4); } catch (e) { N.level = 0; }
    return N.level;
  }
  // the recorder on the open stream: a chunk a second; the blob when it stops
  function recStart(stream) {
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(t => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } }) || '';
    M.chunks = []; M.blob = null;
    const mr = M.mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    M.type = mr.mimeType || type || 'audio/webm';
    M.off = Math.max(0, (clock() - N.t0) / 1000);
    M.done = new Promise(res => {
      mr.ondataavailable = e => { if (e.data && e.data.size) M.chunks.push(e.data); };
      mr.onstop = () => { M.blob = M.chunks.length ? new Blob(M.chunks, { type: M.type }) : null; M.chunks = []; M.state = 'off'; res(M.blob); };
      mr.onerror = () => res(null);
    });
    mr.start(1000); M.state = 'rec';
    meterOn();
  }

  // ------------------------------------------------------------------ pictures --
  const bar = () => (HOST.renderer ? HOST.renderer : null);
  const blank = d => { for (let i = 0; i < d.length; i += 61) if (d[i]) return false; return true; };
  // the canvas to a JPEG as base64 (toBlob, 3 s, else toDataURL)
  async function encode(cv) {
    let url = '';
    try {
      const blob = await new Promise((res, rej) => { const to = setTimeout(() => rej(new Error('slow')), 3000); cv.toBlob(b => { clearTimeout(to); b ? res(b) : rej(new Error('none')); }, 'image/jpeg', 0.82); });
      url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });
    } catch (e) { url = cv.toDataURL('image/jpeg', 0.82); }
    return String(url).replace(/^data:[^,]*,/, '');
  }
  function scaled(src, w, h) {
    const k = Math.min(1, NOTE.shotW / w), cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
    cv.getContext('2d').drawImage(src, 0, 0, w, h, 0, 0, cv.width, cv.height);
    return cv;
  }
  // a headset's frame: the layer's framebuffer, the left eye's viewport, flipped; the binding it had put back
  function grabXR() {
    const r = bar(), gl = r && r.getContext && r.getContext();
    if (!gl) throw new Error('no GL context');
    const s = HOST.session || (r.xr && r.xr.getSession && r.xr.getSession()), layer = s && s.renderState && s.renderState.baseLayer, fb = layer && layer.framebuffer;
    if (!layer || !fb) throw new Error('no layer framebuffer');
    let vp = null;
    try { const c = r.xr.getCamera(G(() => HOST.cur.peek('GL.camera'), null)); const v = c && c.cameras && c.cameras[0] && c.cameras[0].viewport; if (v && v.z > 0 && v.w > 0) vp = { x: v.x, y: v.y, w: v.z, h: v.w }; } catch (e) { /* the left half */ }
    const fw = layer.framebufferWidth || 0, fh = layer.framebufferHeight || 0;
    if (!vp) { if (!fw || !fh) throw new Error('no viewport'); vp = { x: 0, y: 0, w: Math.floor(fw / 2), h: fh }; }
    const two = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext, tgt = two ? gl.READ_FRAMEBUFFER : gl.FRAMEBUFFER;
    const prev = gl.getParameter(two ? gl.READ_FRAMEBUFFER_BINDING : gl.FRAMEBUFFER_BINDING);
    const px = new Uint8Array(vp.w * vp.h * 4);
    try { gl.bindFramebuffer(tgt, fb); gl.readPixels(vp.x, vp.y, vp.w, vp.h, gl.RGBA, gl.UNSIGNED_BYTE, px); }
    finally { gl.bindFramebuffer(tgt, prev); }
    if (blank(px)) throw new Error('the frame read back empty');
    const flip = new Uint8ClampedArray(px.length), row = vp.w * 4;
    for (let y = 0; y < vp.h; y++) flip.set(px.subarray((vp.h - 1 - y) * row, (vp.h - y) * row), y * row);
    for (let i = 3; i < flip.length; i += 4) flip[i] = 255;   // (AR's cleared alpha would make it see-through)
    const cv = document.createElement('canvas'); cv.width = vp.w; cv.height = vp.h;
    cv.getContext('2d').putImageData(new ImageData(flip, vp.w, vp.h), 0, 0);
    return scaled(cv, vp.w, vp.h);
  }
  // a page's: the WebGL canvas as it is drawn (this task, right after the story's frame), pins' markers on it at the end
  function grabPage(end) {
    const r = bar(), cv = r && r.domElement;
    if (!cv || !cv.width) throw new Error('no canvas');
    const out = scaled(cv, cv.width, cv.height), c = out.getContext('2d');
    const d = c.getImageData(0, 0, out.width, out.height).data;
    if (blank(d)) throw new Error('the canvas read back empty');
    if (end && N.kind === 'page') {
      const rc = cv.getBoundingClientRect(), k = out.width / Math.max(1, rc.width);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      for (const p of N.pins) {
        if (typeof p.x !== 'number' || p.x < rc.left || p.x > rc.right || p.y < rc.top || p.y > rc.bottom) continue;
        const x = (p.x - rc.left) * k, y = (p.y - rc.top) * k, rad = 14;
        c.beginPath(); c.arc(x, y, rad, 0, 7); c.fillStyle = 'rgba(255,60,60,0.92)'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#fff'; c.stroke();
        c.fillStyle = '#fff'; c.font = 'bold 16px sans-serif'; c.fillText(String(p.n), x, y + 1);
      }
    }
    return out;
  }
  // the wrap's hook (index.html, outermost after the controllers' guard): only when a picture is wanted. Never throws
  function frame() {
    heldCheck();
    const w = N.want;
    if (!w) return;
    N.want = '';
    const i = w === 'start' ? 0 : 1, end = i === 1, at = w;
    let cv = null, err = '';
    try { cv = inSession() ? grabXR() : grabPage(end); } catch (e) { err = String(e && e.message || e); }
    if (cv) N.shots[i] = encode(cv).then(data => ({ at, type: 'image/jpeg', w: cv.width, h: cv.height, data }), e => ({ at, err: 'encode: ' + (e && e.message) }));
    else N.shots[i] = Promise.resolve({ at, err: err || 'no picture' });
    if (err) log('note picture failed', { at, err });
  }
  // a picture asked for: taken in the next frame (the one after the hold was taken), or given up after a while
  function wantShot(w) {
    N.want = w;
    const i = w === 'start' ? 0 : 1;
    N.shots[i] = null;
    return new Promise(res => {
      const t0 = clock();
      const wait = () => {
        if (N.shots[i]) { N.shots[i].then(res); return; }
        if (clock() - t0 > (w === 'end' ? 2500 : 4000)) { if (N.want === w) N.want = ''; N.shots[i] = Promise.resolve({ at: w, err: 'no frame was drawn' }); res(N.shots[i]); return; }
        setTimeout(wait, 40);
      };
      wait();
    });
  }

  // ------------------------------------------------------------------ the context --
  function device() {
    const ua = navigator.userAgent;
    if (/OculusBrowser|Quest|Pico|Wolvic/i.test(ua)) return 'headset';
    if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet';
    if (/iPhone|Android|Mobile/i.test(ua)) return 'phone';
    return 'desktop';
  }
  function context() {
    const c = {}, set = (k, fn) => { try { const v = fn(); if (v !== undefined) c[k] = v; } catch (e) { /* left out */ } };
    set('release', () => N.rel || undefined);
    set('format', () => (HOST.collab && HOST.collab.format) || undefined);
    set('shell', () => (HOST.shell ? { n: HOST.shell.n, id: HOST.shell.id } : undefined));
    set('url', () => clean(location.origin + location.pathname + location.hash));
    set('device', device);
    set('ua', () => navigator.userAgent);
    set('browser', () => (/OculusBrowser\/([\d.]+)/.exec(navigator.userAgent) || [])[1] || undefined);
    set('screen', () => ({ w: innerWidth, h: innerHeight, dpr: +(devicePixelRatio || 1).toFixed(2) }));
    set('xr', () => (HOST.session ? (/ar/i.test(HOST.mode || '') && !/vr/i.test(HOST.mode || '') ? 'ar' : 'vr') : ''));
    set('focus', () => (HOST.focus ? !!HOST.focus() : undefined));
    set('story', () => HOST.curKey || '');
    const A = G(() => HOST.cur.collab.APP, null);
    if (A) {
      set('mode', () => A.mode);
      set('t', () => +(+A.t || 0).toFixed(2));
      set('playing', () => !!A.playing);
      set('chapter', () => {
        const ch = HOST.cur.peek('CH'), t = +A.t || 0;
        if (!Array.isArray(ch) || !ch.length) return undefined;
        let i = 0; for (let k = 1; k < ch.length; k++) if (t >= (ch[k].na !== undefined ? ch[k].na : ch[k].a)) i = k;
        const e = ch[i]; return { i, key: e.key, title: typeof e.name === 'string' ? e.name : (e.title || '') };
      });
    }
    set('state', () => {
      const s = HOST.cur && HOST.cur.collab && HOST.cur.collab.state && HOST.cur.collab.state();
      if (s === undefined) return undefined;
      const j = JSON.stringify(s);
      return j.length > 16384 ? { cut: true, text: j.slice(0, 16384) } : s;
    });
    if (HOST.curKey === 'studio') set('studio', () => {
      const s = HOST.cur.peek('STUDIO.state()') || {};
      const n = v => (Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : +v || 0);
      return { source: s.source, scene: s.scene, edit: s.edit, sel: s.sel, items: n(s.items), unsaved: s.unsaved };
    });
    set('room', () => (L.room ? L.room() : undefined));
    set('settings', () => {
      const x = HOST.xr || {}, o = {};
      for (const k of ['labels', 'cards', 'free', 'subs', 'sfx', 'voice', 'walk', 'fps', 'hz']) { try { if (typeof x[k] === 'function') o[k] = x[k](); } catch (e) { /* left out */ } }
      try { if (HOST.occlusion) o.occl = HOST.occlusion.mode(); } catch (e) { /* left out */ }
      try { if (HOST.panels) o.panels = HOST.panels.get(HOST.curKey); } catch (e) { /* left out */ }
      return o;
    });
    set('perf', () => { const p = HOST.perf && HOST.perf.stats && HOST.perf.stats(); const f = L.fps ? L.fps() : 0; return Object.assign({}, p ? { tri: Math.round(p.tri), calls: Math.round(p.calls), js: +p.js.toFixed(2) } : {}, f ? { fps: f } : {}); });
    set('log', () => (window.__collabLog || []).slice(-60).map(e => clean('+' + e.t + ' ' + e.ev + ' ' + JSON.stringify(Object.assign({}, e, { t: undefined, n: undefined, ev: undefined })))).join('\n'));
    return c;
  }
  fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).then(v => { if (v && typeof v.version === 'string') N.rel = v.version; }).catch(() => {});

  // ------------------------------------------------------------------ recording --
  const nonce = () => { const a = 'abcdefghijklmnopqrstuvwxyz0123456789', b = new Uint8Array(16); try { crypto.getRandomValues(b); } catch (e) { for (let i = 0; i < 16; i++) b[i] = Math.random() * 256; } return Array.from(b, v => a[v % 36]).join(''); };
  const b64 = blob => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).replace(/^data:[^,]*,/, '')); fr.onerror = () => res(''); fr.readAsDataURL(blob); });
  let tick = 0;
  function start(why) {
    if (N.rec || !devOn()) return false;
    const headset = inSession();
    N.rec = true; N.how = why || ''; N.kind = headset ? 'headset' : 'page'; N.t0 = clock(); N.at = Date.now(); N.pins = []; N.shots = [null, null]; N.cancel = false; N.pinsUntil = 0;
    N.sess = headset; N.noAudio = ''; N.denied = false; N.startP = wantShot('start');
    log('note start', { kind: N.kind, why });
    if (headset) { if (L.sfx) L.sfx('toggleOn'); if (L.pulse && N.src) L.pulse(N.src, 0.3, 40); }
    else strip('Recording: tap or click anywhere to pin it. Press again to send.');
    // (asked as it begins, so the first words are not clipped while it opens; a refusal on a page stops it)
    if (micThere()) {
      N.micP = micAsk(headset ? 4000 : 15000).then(s => { if (!N.rec) { micKeepOpen(); return; } recStart(s); }, e => {
        N.noAudio = e && e.name === 'Timeout' ? 'no answer' : String(e && e.name || e);
        if (!headset && N.rec) { N.denied = true; N.cancel = true; stop(false); strip('The microphone is not allowed: allow it for this site in the browser\'s settings.'); return; }
        if (N.rec) notice('The microphone is not allowed here', 'Record a note once on the 2D page first (the round button at the bottom right) and allow it there.', 6000);
      });
    } else if (!headset) { N.denied = true; N.cancel = true; N.rec = false; strip('This browser cannot record the microphone.'); return false; }
    else N.noAudio = 'no microphone';
    clearInterval(tick);
    tick = setInterval(() => { if (N.rec && (clock() - N.t0) / 1000 >= NOTE.max) stop(true); }, 250);
    paint();
    return true;
  }
  async function stop(send) {
    if (!N.rec) return;
    N.rec = false; clearInterval(tick);
    const dur = Math.max(0, (clock() - N.t0) / 1000), cancel = !send || N.cancel, headset = N.kind === 'headset';
    N.pinsUntil = clock() + (headset ? NOTE.pinsHeadset : NOTE.pinsPage);
    const pins = N.pins.slice(), at = N.at, kind = N.kind, startP = N.startP, offA = M.off, micP = N.micP, noAudio = N.noAudio;
    if (headset && L.sfx) L.sfx('toggleOff');
    N.busy++;
    const endP = cancel ? Promise.resolve(null) : wantShot('end');
    if (N.src) { N.spent = N.src; N.src = null; }   // (whatever stopped it, the hold is over)
    const mr = M.mr, done = M.done;   // (a new note may begin during the awaits: its recorder is not ours to clear)
    try { if (mr && mr.state !== 'inactive') mr.stop(); } catch (e) { /* stopped */ }
    const blob = mr ? await Promise.race([done, new Promise(r => setTimeout(() => r(null), 4000))]) : null;
    if (M.mr === mr) { M.mr = null; meterOff(); }
    if (micLive() && !N.rec) micKeepOpen();
    if (cancel) { N.busy--; if (!N.denied) { notice('Note cancelled', '', 2000); strip('Note cancelled.'); } N.pinsUntil = 0; log('note cancelled', {}); paint(); return; }
    const shots = [await startP, await endP].filter(Boolean);
    const note = { v: 1, nonce: nonce(), at, dur: +dur.toFixed(2), kind, name: G(() => L.name(), '') || undefined, audio: null, shots, pins, context: context() };
    if (blob && blob.size) { note.audio = { type: blob.type || 'audio/webm', data: await b64(blob), off: +offA.toFixed(2) }; }
    else if (micP && noAudio) note.audioErr = noAudio;
    N.busy--;
    log('note made', { dur: note.dur, pins: pins.length, audio: !!note.audio, shots: shots.map(s => s.err ? 'err' : 'ok') });
    await deliver(note);
    paint();
  }
  const rel = () => (clock() - N.t0) / 1000;
  // a headset press while recording: a pin (the press still does what it does)
  function pin(e) {
    if (!N.rec || N.kind !== 'headset' || !e) return;
    try {
      const s = HOST.session, src = e.inputSource;
      let i = -1; try { i = [...s.inputSources].indexOf(src); } catch (x) { /* gone */ }
      const h = L.pinHit ? L.pinHit(i) : null;
      const P = { n: N.pins.length + 1, t: +rel().toFixed(3), hand: (src && src.hand ? 'hand-' : '') + ((src && src.handedness) || '') };
      if (h) { P.p = h.p.map(v => +v.toFixed(3)); if (h.room) P.room = h.room.map(v => +v.toFixed(3)); P.hit = h.hit; } else P.hit = { kind: 'none' };
      N.pins.push(P);
      log('note pin', { n: P.n, kind: P.hit && P.hit.kind });
    } catch (x) { /* never in the way */ }
  }
  const elOf = x => {
    if (!x) return { tag: '' };
    const tag = String(x.tagName || '').toLowerCase();
    if (tag === 'canvas') return { tag };
    return { tag, id: String(x.id || '').slice(0, 60), cls: String(typeof x.className === 'string' ? x.className : '').slice(0, 60), text: String(x.innerText || x.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) };
  };
  // a page's pointerdown anywhere (capture, never stopped)
  function pagePin(ev) {
    if (!N.rec || N.kind !== 'page') return;
    try {
      if (ev.target && ev.target.closest && ev.target.closest('#noteBtn')) return;
      const el = document.elementFromPoint(ev.clientX, ev.clientY) || ev.target;
      N.pins.push({ n: N.pins.length + 1, t: +rel().toFixed(3), x: Math.round(ev.clientX), y: Math.round(ev.clientY), el: elOf(el) });
      marks();
    } catch (x) { /* never in the way */ }
  }

  // ------------------------------------------------------------------ a page's button, strip and markers --
  const UI = { btn: null, strip: null, marks: null, css: false, stripT: 0 };
  function build() {
    if (UI.btn) return;
    const st = document.createElement('style');
    st.textContent = `#noteBtn { position: fixed; right: max(16px, env(safe-area-inset-right, 0px)); bottom: calc(var(--fc-bot, 0px) + 16px + env(safe-area-inset-bottom, 0px)); z-index: 9; width: 52px; height: 52px; border-radius: 50%; border: 1px solid #ffffff44; background: #1b2a42; color: #fff; display: grid; place-items: center; cursor: pointer; font: 600 13px/1 system-ui, sans-serif; box-shadow: 0 2px 10px #0008; padding: 0; }
#noteBtn[hidden], #noteStrip[hidden], #noteMarks[hidden] { display: none; }
#noteBtn.rec { background: #d93a3a; border-color: #fff; }
#noteBtn svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
#noteStrip { position: fixed; right: calc(max(16px, env(safe-area-inset-right, 0px)) + 62px); bottom: calc(var(--fc-bot, 0px) + 20px + env(safe-area-inset-bottom, 0px)); z-index: 9; max-width: min(320px, calc(100vw - 100px)); padding: 8px 12px; border-radius: 10px; background: #0b1424ee; color: #e6edf7; font: 14px/1.35 system-ui, sans-serif; border: 1px solid #ffffff22; pointer-events: none; }
#noteMarks { position: fixed; inset: 0; z-index: 10; pointer-events: none; }
#noteMarks i { position: absolute; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; background: #ff3c3cee; border: 2px solid #fff; color: #fff; font: 700 14px/22px system-ui, sans-serif; text-align: center; font-style: normal; }`;
    document.head.appendChild(st);
    const b = UI.btn = document.createElement('button');
    b.id = 'noteBtn'; b.type = 'button'; b.hidden = true; b.setAttribute('aria-label', 'Record a developer note'); b.title = 'Record a note (developer mode)';
    b.setAttribute('data-sfx', 'none');
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
    const s = UI.strip = document.createElement('div'); s.id = 'noteStrip'; s.hidden = true; s.setAttribute('role', 'status');
    const m = UI.marks = document.createElement('div'); m.id = 'noteMarks'; m.hidden = true;
    document.body.append(b, s, m);
    quiet(() => {
      b.addEventListener('click', () => { if (N.rec) stop(true); else start('button'); });
      document.addEventListener('pointerdown', pagePin, true);
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && N.rec && N.kind === 'page') { N.cancel = true; stop(false); } }, true);
    });
  }
  function strip(text) {
    N.strip = text || '';
    if (!UI.strip) return;
    UI.strip.textContent = N.strip; UI.strip.hidden = !N.strip;
    clearTimeout(UI.stripT);
    if (N.strip && !N.rec && !/^Note kept/.test(N.strip)) UI.stripT = setTimeout(() => { if (!N.rec) { N.strip = ''; UI.strip.hidden = true; } }, 6000);
  }
  function marks() {
    if (!UI.marks) return;
    const show = N.kind === 'page' && (N.rec || clock() < N.pinsUntil) && N.pins.length && !inSession();
    UI.marks.hidden = !show;
    if (!show) { UI.marks.textContent = ''; return; }
    if (UI.marks.childElementCount !== N.pins.length) {
      UI.marks.textContent = '';
      for (const p of N.pins) { const i = document.createElement('i'); i.textContent = p.n; i.style.left = p.x + 'px'; i.style.top = p.y + 'px'; UI.marks.appendChild(i); }
    }
  }
  function paint() {
    if (!UI.btn) return;
    const on = devOn() && !inSession() && !(HOST.renderer && HOST.renderer.xr && HOST.renderer.xr.isPresenting);
    UI.btn.hidden = !on;
    const recording = on && N.rec && N.kind === 'page';
    UI.btn.classList.toggle('rec', recording);
    if (recording) UI.btn.textContent = mmss(rel()); else if (!UI.btn.querySelector('svg')) UI.btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
    if (!on) { UI.strip.hidden = true; UI.marks.hidden = true; }
    else if (N.strip) UI.strip.hidden = false;
    marks();
  }
  // a held B or Y whose controller is gone (disconnected, replaced), whose session ended or with developer mode off: let go
  function heldCheck() {
    const src = N.src;
    if (!src) return;
    let gone = !inSession() || !devOn();
    if (!gone) { try { gone = ![...HOST.session.inputSources].includes(src); } catch (e) { gone = true; } }
    if (!gone) return;
    N.src = null; N.spent = null;
    log('note hold released', { dev: devOn(), session: inSession() });
    if (N.rec && N.how === 'hold') { N.cancel = false; stop(true); }
  }
  // developer mode, the session and the microphone: looked at twice a second (cheap)
  const W = { dev: false, sess: false };
  function watch() {
    const dev = devOn(), s = inSession();
    heldCheck();
    if (W.dev && !dev) {   // (developer mode turned off: a recording stops without sending, the microphone is let go)
      if (N.rec) { N.cancel = true; stop(false); }
      micClose();
    }
    if (W.sess && !s) {   // (the session ended)
      if (N.rec && N.kind === 'headset') { N.cancel = false; stop(true); }
      micClose(); N.src = null;
    }
    W.dev = dev; W.sess = s;
    if (dev) build();
    paint();
  }
  setInterval(watch, 500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { flush(); watch(); } });
  window.addEventListener('online', () => flush());
  setInterval(() => { if (N.outN) flush(); }, 60000);
  setTimeout(() => { outCount().then(n => { if (n) flush(); }); watch(); }, 3000);
  outCount();

  return {
    link(o) { L = o || {}; },
    state: () => ({ rec: N.rec, since: N.rec ? +rel().toFixed(2) : 0, pins: N.pins.length, outbox: N.outN, sent: N.sent, last: Object.assign({}, N.last), mic: M.state, kind: N.kind, busy: N.busy, strip: N.strip }),
    can: src => !!(devOn() && src && !src.hand && HOST.session),
    // shared.js's sticks: B or Y (button 5) of a controller, its press began at dn (ms); true while it is a hold (0.45 s)
    hold(src, down, dn, t) {
      if (!devOn() || !src || src.hand) return false;
      if (N.spent === src) { if (!down) N.spent = null; return down; }   // (a stopped note's button, still down)
      if (down) {
        if (N.src === src) return true;
        if (!N.src && dn > 0 && t - dn >= NOTE.holdMs) { N.src = src; if (!N.rec) start('hold'); return true; }
        return false;
      }
      if (N.src === src) { N.src = null; if (N.rec && N.how === 'hold') stop(true); return true; }
      return false;
    },
    pin, start, stop: send => stop(send !== false), frame, context, outbox: () => outAll(), flush,
    // what shared.js draws while a note is recorded (the read-out, the pins): null when nothing shows
    view() {
      const t = clock(), pinsOn = N.kind === 'headset' && N.pins.length && (N.rec || t < N.pinsUntil);
      if (!N.rec && !pinsOn) return null;
      return { rec: N.rec && N.kind === 'headset', sec: N.rec ? rel() : 0, pins: N.kind === 'headset' && pinsOn ? N.pins.filter(p => p.p).map(p => ({ n: p.n, p: p.p })) : [], held: !!N.src, hand: N.src ? N.src.handedness : '', level: N.rec ? level() : 0, count: N.pins.length, mic: N.noAudio };
    },
    test(o) { if (o && 'clock' in o) T.clock = o.clock; if (o && 'noMic' in o) T.noMic = !!o.noMic; return { clock: !!T.clock, noMic: T.noMic }; },
  };
})();

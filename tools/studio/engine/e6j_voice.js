// ============================================= LONG RECORDINGS AND VOICES ==
// The owner, 8 November 2026: "Add voice recording option to the motion recorder, make length up to ten minutes possible?"
// (tools/studio/SPEC.md, "Recorded paths": "Ten minutes, as a file" and "A voice with the movement").
//
// Long recordings. With a relay that takes uploads a recording may run up to 600 s (recCap). One longer than 120 s, or of
// more than 600 keys once simplified, is kept as a file of the scene, recordings/<the item's name>-<n>.json (the first n
// free; a recording is never written over, so Undo can give an older record back with its file): { studio: 1,
// recording: 1, item, len, n, k }, its keys as a record keeps them (e6f_path.js: normKeys, at most 40,000 and 600 s), at
// most 4 MB (the relay's rule, relay/scenes.mjs). It goes up as the converter's GLBs do (upSend: through the relay, or
// straight into R2), and the record's path then names it (src, len, n). The device that made it keeps its keys at once
// (own); every other device reads the file (pathK: call(), so the relay's password as a header, or R2's signed link) once
// it is in the scene's listing, and again when it changes; until its keys are in, the item rests where it is placed.
//
// A voice with the movement. With my voice (a switch on the recorder's rows, page and headset, this device's own,
// studioRecVoice) asks for the microphone as it is turned on (the browser's question: in a headset that question may not
// show inside the session, so the card says to allow it on the 2D page first). While a recording runs with it on, the
// microphone is recorded (MediaRecorder, a chunk a second), with a short level meter on the card (an analyser on the
// shell's context, HOST.audio.fx(), connected to nothing else: no context of the studio's own). Kept with the recording:
// made a mono sound as the Upload pane makes sounds (up to 20 s a 16-bit WAV decoded in the page by monoWav, e7b_upload.js,
// the one OfflineAudioContext; longer, the relay's ffmpeg makes it a mono MP3; with no ffmpeg it is kept as it came, a WebM
// or the like), uploaded to sounds/<the item's name>-voice-<n> (Record again with the voice on: the same file replaced when
// its kind is the same), and placed as a sound item, "<item> voice", following the recorded item (on its Head bone when it
// has one, else at its top), whose record says it plays with that item's path: sync (the item's id), skip (seconds into its
// file where the path's start is: what the loop join cut from the path's start, less how late the microphone started;
// negative: the voice starts that much after the path) and len (how long of it plays). It starts each time the path starts
// its loop (once, with one that plays once; on the way there, with one that goes back and forth), on the path's clock, so
// everyone at a circle hears it at the same moment (syncAt, from emitStep); at a path speed other than ×1 it plays at its
// own pace from each start. The path and the voice are written in one change (one Undo step: files stay in the scene).
// Deleting the recording leaves the sound, no longer synced: it plays as a sound of its own (its card says so).

// ----------------------------------------------------------- long recordings --
// PF: a recording file's keys by its path ({ k, state: 'loading' | 'ok' | 'bad', at (the listing's time it was read at),
// own (made here), gen (the scene's opening), err, failAt }). KEEP: items whose last recording's files are going in now
const PF = new Map(), KEEP = new Map();
const keepSig = () => [...KEEP.values()].map(k => k.text).join('|') + ':' + [...PF.values()].map(f => f.state).join('');
// a path's keys: its own, or its file's once read (null meanwhile)
function pathK(P) {
  if (P.k) return P.k;
  let f = PF.get(P.src);
  if (f && f.gen !== STU.gen) { PF.delete(P.src); f = null; }   // (another scene's, or this one opened again)
  if (f && f.own) return f.k;
  const L = STU.fileMap.get(P.src);
  if (L && (!f || (f.state !== 'loading' && (f.at !== L.at || (f.state === 'bad' && performance.now() - f.failAt > 10000))))) pfLoad(P.src, L);
  return f && f.k ? f.k : null;
}
async function pfLoad(src, L) {
  const gen = STU.gen, was = PF.get(src), e = { k: was && was.gen === gen ? was.k : null, state: 'loading', at: L.at, own: false, gen, err: '', failAt: 0 };
  PF.set(src, e);
  try {
    const j = await getJSON(fileUrl(src));
    if (gen !== STU.gen || PF.get(src) !== e) return;
    const k = j && typeof j === 'object' && !Array.isArray(j) ? normKeys(j.k, PATH_MAX.fileKeys, PATH_MAX.long) : null;
    if (!k) throw new Error('its keys could not be read');
    e.k = k; e.state = 'ok';
  } catch (err) {
    if (gen !== STU.gen || PF.get(src) !== e) return;
    e.state = 'bad'; e.failAt = performance.now();
    e.err = `Its file ${src} could not be read (${err.status === 404 ? 'it is not in the scene' : err.status === 401 ? 'the relay wants its password' : err.message}): it stands where it is placed.`;
  }
  dirty();
}
// the first free name in the scene: <base>-<n>.<ext>, n from 1 (past from, when a name was taken meanwhile)
function numbered(base, ext, past) {
  const m = past ? /-(\d+)\.[^.]+$/.exec(past) : null;
  for (let n = m ? +m[1] + 1 : 1; ; n++) { const p = `${base}-${n}.${ext}`; if (!STU.fileMap.has(p) && !PF.has(p)) return p; }
}
// a recording's keys up as a file (a name taken meanwhile: the next); its path, its keys kept here at once
async function recFile(it, k, len) {
  const scene = STU.scene, gen = STU.gen, base = 'recordings/' + safeSeg(words(it.rec.name, 60));
  const text = JSON.stringify({ studio: 1, recording: 1, item: it.rec.name, len, n: k.length, k });
  let p = numbered(base, 'json');
  for (let tries = 0; ; tries++) {
    try {
      const j = await upSend(fileApi(scene, p, false), new Blob([text], { type: 'application/json' }));
      const out = (j && j.path) || p;
      if (gen === STU.gen) { PF.set(out, { k, state: 'ok', at: 0, own: true, gen, err: '', failAt: 0 }); refreshFiles(new Set([out])); }
      return out;
    } catch (e) { if (e.status !== 409 || tries > 20) throw e; p = numbered(base, 'json', p); }
  }
}
// The recording kept once its files are in the scene (a long one's keys, its voice): then the path, and its voice's sound,
// written in one change (one Undo step). raw: Keep it as recorded (its voice's sound kept as it is, only where it starts)
async function recKeep(it, R, res, raw) {
  const id = it.id, gen = STU.gen, K = { text: res.keys ? 'Keeping the recording: its file goes into the scene...' : 'Keeping the recording with your voice...' };
  KEEP.set(id, K); dirty(true);
  let path = res.path, voice = null, vwhy = '';
  try {
    if (res.keys) path = normPath(Object.assign({}, res.path, { src: await recFile(it, res.keys, pathLen(res.path)) }));
    if (R.v) {
      K.text = 'Keeping your voice: it goes into the scene as a sound...'; dirty(true);
      try { voice = await voiceKeep(it, R); } catch (e) { vwhy = e.status === 401 ? AUTH_NOTE : e.message; }
    }
  } catch (e) {
    KEEP.delete(id);
    if (gen === STU.gen) recSay(id, `The recording could not be kept (nothing changed): ${e.status === 401 ? AUTH_NOTE : e.message}`, 'amber');
    voiceDrop(R);
    return;
  }
  KEEP.delete(id);
  if (gen !== STU.gen || GL.gone || STU.items.get(id) !== it || !path) { dirty(true); return; }
  let ok = false, vid = '';
  change(() => { ok = !!setRec(id, { path }); if (ok && voice) vid = voicePlace(it, voice, path, res); });
  if (!ok) { recSay(id, 'The recording could not be kept.', 'amber'); return; }
  const vs = !R.v ? '' : vid ? ` Your voice is ${STU.items.get(vid).rec.name} (${voice.made}): it follows ${it.rec.name} and plays with its path.` : voice ? ` Your voice is in the scene as ${voice.file}, but no sound could be placed (a scene holds ${LIMITS.s} sounds).` : ` Your voice was not kept: ${vwhy || 'nothing came from the microphone'}.`;
  if (raw) recSay(id, `Kept as recorded: ${secs(pathLen(path))} in ${fmt(pathCount(path))} keys` + (path.src ? `, as the file ${path.src}.` : '.') + vs, 'muted');
  else {
    recSay(id, recWords(R, { path }) + ' It plays now; its ghost shows where it is placed.' + vs, R.capped || (R.v && !vid) ? 'amber' : 'green', joinNote(res.join, path));
    sfxAct('rise', 'world', it.holder.getWorldPosition(new THREE.Vector3()).toArray(), { dur: 0.5, gain: 0.5 });
  }
  tcAttach();
}
// an object switched to its GLB (switchToGLB) whose recorded path is kept as a file: its keys turned as a path in a record
// is (pathTurned) and written as a new file, so its record names that one ({ id: its new path }); one that cannot be (its
// keys not in, no relay that takes uploads) keeps its file, said
async function pathFilesTurned(orig, rec) {
  const E = LIB.get(orig), g = rec || (E && E.guess) || { q: [0, 0, 0, 1] }, out = new Map();   // (as switchToGLB takes it)
  if (!g.q || (Math.abs(g.q[3]) > 0.999999)) return out;   // (nothing turned)
  for (const it of [...STU.items.values()].filter(x => x.kind === 'o' && x.rec.file === orig && x.rec.path && x.rec.path.src)) {
    const P = it.rec.path;
    let K = pathK(P);
    for (let i = 0; !K && i < 50 && STU.fileMap.has(P.src); i++) { await new Promise(r => later(r, 100)); K = pathK(P); }
    if (!K || !canUpload()) continue;
    try { out.set(it.id, normPath(Object.assign({}, P, { src: await recFile(it, normKeys(keysTurned(K, g.q), PATH_MAX.fileKeys, PATH_MAX.long) || K, P.len) }))); } catch (e) { /* kept as it was */ }
  }
  return out;
}

// ------------------------------------------------------------------ the voice --
const VOICE = { on: store.get('studioRecVoice') === '1', asking: false, note: '' };
const voiceSig = () => [VOICE.on, VOICE.asking, VOICE.note].join(':');
const VOICE_KINDS = ['o', 'p', 'e'];
// this browser can record the microphone, and the scene keeps what is made (a relay that takes uploads)
const micThere = () => typeof MediaRecorder !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
const voiceCan = () => micThere() && canUpload();
// the microphone, asked for (15 s at most: a question the browser never shows, as inside a headset's session, is given
// up; a stream that comes after all is let go)
function micAsk() {
  return new Promise((res, rej) => {
    let done = false;
    const t = later(() => { done = true; rej(Object.assign(new Error('no answer'), { name: 'Timeout' })); }, 15000);
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(s => {
      if (done) { for (const tr of s.getTracks()) tr.stop(); return; }
      done = true; unlater(t); res(s);
    }, e => { if (done) return; done = true; unlater(t); rej(e); });
  });
}
const micWhy = e => (e && e.name === 'NotAllowedError' ? 'The microphone was refused: allow it for this page (the browser\'s address bar), then turn this on again.'
  : e && e.name === 'NotFoundError' ? 'No microphone was found on this device.'
  : e && e.name === 'Timeout' ? (XR.on ? 'No answer about the microphone: in a headset the browser may not show its question. Take the headset off the session, turn this on on the 2D page first, then come back.' : 'No answer about the microphone.')
  : 'The microphone could not be used' + (e && e.message ? ` (${e.message})` : '') + '.');
// the switch (this device's own, kept): turned on, the microphone is asked for at once (and let go: it is opened again
// as a recording begins); off, nothing is recorded
async function voiceSwitch() {
  if (VOICE.asking) return;
  if (VOICE.on) { VOICE.on = false; VOICE.note = ''; store.set('studioRecVoice', null); dirty(true); return; }
  if (!micThere()) { VOICE.note = 'This browser cannot record the microphone.'; dirty(true); return; }
  VOICE.asking = true; VOICE.note = ''; dirty(true);
  try {
    const s = await micAsk();
    for (const tr of s.getTracks()) tr.stop();
    VOICE.on = true; store.set('studioRecVoice', '1');
  } catch (e) { VOICE.on = false; VOICE.note = micWhy(e); }
  VOICE.asking = false; dirty(true);
}
// a recording begins with the voice on: the microphone opened and recorded (V.t0: when it began, real time; the
// recording's own began at R.real0). null: no voice with this one
function voiceBegin(R) {
  if (!VOICE.on || !voiceCan() || !VOICE_KINDS.includes(R.it.kind)) return null;
  const V = { state: 'asking', chunks: [], t0: 0, end: 0, dur: 0, lvl: 0, err: '', mr: null, stream: null, an: null, src: null, buf: null, type: '', ext: 'webm', stopped: false, drop: false, kept: null, blob: null };
  V.done = new Promise(res => { V.fin = res; });
  micAsk().then(stream => {
    if (V.stopped) { for (const tr of stream.getTracks()) tr.stop(); V.state = 'off'; V.fin(null); return; }
    V.stream = stream;
    try {
      const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(t => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } }) || '';
      const mr = V.mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      V.type = mr.mimeType || type || 'audio/webm';
      V.ext = /mp4|aac/.test(V.type) ? 'm4a' : /ogg/.test(V.type) ? 'ogg' : 'webm';
      mr.ondataavailable = e => { if (e.data && e.data.size && !V.drop) V.chunks.push(e.data); };
      mr.onstop = () => {
        for (const tr of stream.getTracks()) tr.stop();
        meterOff(V);
        V.state = 'done';
        V.blob = V.chunks.length && !V.drop ? new Blob(V.chunks, { type: V.type }) : null;
        V.chunks = [];
        V.fin(V.blob);
      };
      mr.start(1000);
      V.t0 = performance.now(); V.state = 'on';
      meterOn(V);
    } catch (e) { V.state = 'failed'; V.err = micWhy(e); for (const tr of stream.getTracks()) tr.stop(); V.fin(null); }
    dirty();
  }, e => { V.state = 'failed'; V.err = micWhy(e); V.fin(null); dirty(); });
  return V;
}
// its level on the card: an analyser on the shell's context (none while the shell has none: muted, or before a tap)
function meterOn(V) {
  try {
    const ctx = HOST.audio && HOST.audio.fx ? HOST.audio.fx() : null;
    if (!ctx || !V.stream) return;
    V.src = ctx.createMediaStreamSource(V.stream); V.an = ctx.createAnalyser(); V.an.fftSize = 1024; V.buf = new Float32Array(V.an.fftSize);
    V.src.connect(V.an);   // (to nothing else: nothing of it is heard)
  } catch (e) { V.an = null; }
}
function meterOff(V) { for (const n of [V.src, V.an]) try { if (n) n.disconnect(); } catch (e) { /* gone */ } V.src = V.an = null; }
// (0 to 8: -60 dB and below to -12 dB and above)
function voiceLevel(R) {
  const V = R.v;
  if (!V || !V.an) return;
  try {
    V.an.getFloatTimeDomainData(V.buf);
    let s = 0;
    for (let i = 0; i < V.buf.length; i++) s += V.buf[i] * V.buf[i];
    const db = 10 * Math.log10(s / V.buf.length + 1e-12);
    V.lvl = clamp(Math.round((db + 60) / 6), 0, 8);
  } catch (e) { V.an = null; }
}
// the recording ends: the microphone stops (its sound comes as the recorder says so: V.done)
function voiceEnd(R) {
  const V = R.v;
  if (!V) return;
  V.stopped = true;
  if (V.mr && V.mr.state !== 'inactive') { V.end = performance.now(); V.dur = (V.end - V.t0) / 1000; try { V.mr.stop(); } catch (e) { V.fin(null); } }
}
// not kept: what came is let go
function voiceDrop(R) { const V = R && R.v; if (V && !V.kept) { V.drop = true; V.chunks = []; V.blob = null; } }
// the voice made a mono sound of the scene: { file, lead (s: how late the microphone began after the recording), dur, made }
async function voiceKeep(it, R) {
  const V = R.v;
  if (V.kept) return V.kept;   // (Keep it as recorded: the same sound)
  const blob = await V.done;
  if (!blob || !blob.size) throw new Error(V.err || 'nothing came from the microphone');
  const scene = STU.scene, old = voiceOf(it.id), base = 'sounds/' + safeSeg(words(it.rec.name, 60) + '-voice');
  let ext = V.ext, body = blob, via = 'file', made = `kept as it came (${V.ext.toUpperCase()}: this relay has no ffmpeg)`, dur = V.dur;
  if (V.dur <= STREAM_S) {
    const w = await monoWav(await blob.arrayBuffer(), 48000);
    ext = 'wav'; body = new Blob([w.wav], { type: 'audio/wav' }); dur = w.dur; made = `mono WAV, ${w.rate} Hz, ${secs(w.dur)}`;
  } else if (SRC.ffmpeg) { ext = 'mp3'; via = 'sound'; made = `mono MP3 by the relay's ffmpeg, ${secs(V.dur)}`; }
  // (Record again: the sound's own file replaced when it is of the same kind)
  const same = old && old.rec.file.startsWith('sounds/') && extOf(old.rec.file) === ext ? old.rec.file : '';
  let p = same || numbered(base, ext), j = null;
  for (let tries = 0; ; tries++) {
    try {
      if (via === 'sound') {
        for (let k = 0; ; k++) {
          try { j = await upSend(soundApi(scene, p, !!same), body); break; } catch (e) { if (e.status !== 429 || k > 8) throw e; await new Promise(r => later(r, 1000 * Math.max(2, e.retry || 3))); }
        }
      } else j = await upSend(fileApi(scene, p, !!same), body);
      break;
    } catch (e) {
      if (e.status === 409 && !same && tries < 20) { p = numbered(base, ext, p); continue; }
      // (the relay has no ffmpeg after all: as it came)
      if (via === 'sound' && e.status === 501) { via = 'file'; ext = V.ext; made = `kept as it came (${V.ext.toUpperCase()}: this relay has no ffmpeg)`; p = same && extOf(same) === ext ? same : numbered(base, ext); continue; }
      throw e;
    }
  }
  const file = (j && j.path) || p;
  await refreshFiles(new Set([file]));
  return (V.kept = { file, lead: (V.t0 - R.real0) / 1000, dur, made });
}
// the sound that plays with an item's recorded path (the first by id), or null
const voiceOf = id => [...STU.items.values()].filter(s => s.kind === 's' && s.rec.sync === id).sort((a, b) => (a.id < b.id ? -1 : 1))[0] || null;
// where a voice goes on the item: its Head bone, else its top (as it is placed)
function voiceSpot(it) {
  return atPlaced([it], () => {
    const head = it.kind === 'o' && it.model && it.E ? (bonesOf(it.E).slots.find(x => x[0] === 'Head') || [])[1] : '';
    const nd = head ? nodeOf(it, head) : null;
    if (nd) return { p: followPoint(nd, null, new THREE.Vector3()).toArray(), bone: head };
    const top = itemTopInto(it, new THREE.Vector3(), false);
    return { p: top.toArray(), o: offsetAt(it.holder, top, followK(it)) };
  });
}
// its sound placed (or, recorded again, its file and start changed), in the change that writes the path; its id ('' none:
// the scene's sounds are full)
function voicePlace(it, v, path, res) {
  const skip = r3(clamp((res.c0 || 0) - v.lead, -10, 600)), len = r3(Math.min(pathLen(path), v.dur - Math.max(0, skip)));
  const sync = { file: v.file, sync: it.id, skip: skip || undefined, len: len > 0.05 ? len : undefined, loop: false };
  const old = voiceOf(it.id);
  if (old) return setRec(old.id, sync) ? old.id : '';
  if (countOf('s') >= LIMITS.s) return '';
  const at = voiceSpot(it), id = newId();
  return putItem(id, 's', norm('s', Object.assign({ name: nameFor(words(it.rec.name, 48) + ' voice'), p: at.p, on: it.id, bone: at.bone, o: at.o, vol: 1, r: 1.5, start: 'always' }, sync))) ? id : '';
}

// --------------------------------------------------------- playing with a path --
// the item whose recorded path a sound plays with (null: none, or it has no path now: it plays as a sound of its own)
const syncOf = it => { const o = it.kind === 's' && it.rec.sync ? STU.items.get(it.rec.sync) : null; return o && pathOf(o) ? o : null; };
// where in its file a voice is at now (ms; dur: its file's length, s): { at (s into its file; below 0: it starts that much
// later), left (s it plays on from there), pass (the path's pass: a new one starts it again), e } or null while it is
// silent (between passes, the path resting or its keys not in)
function syncAt(it, now, dur) {
  const ob = syncOf(it), P = ob && pathOf(ob);
  if (!P || !pathK(P) || motionRests(ob)) return null;
  const D = pathLen(P), u = Math.max(0, pathClock(ob, P, now, sceneClock(now)) * P.speed);
  if (!(D > 0)) return null;
  const per = P.play === 'bounce' ? 2 * D : D, pass = P.play === 'once' ? 0 : Math.floor(u / per), e = (u - pass * per) / P.speed;
  const skip = it.rec.skip || 0, len = Math.min(it.rec.len || Infinity, (dur || Infinity) - Math.max(0, skip));
  return e < len - 0.05 ? { at: skip + e, left: len - e, pass, e } : null;
}
// (for tests: a synced sound's start, and where its voice and its path are now)
function voiceState(id) {
  const it = STU.items.get(id);
  if (!it || it.kind !== 's') return null;
  const now = performance.now(), F = it.F, ctx = EM.ctx, L = it.syncLog || null;
  const s = syncAt(it, now, F && F.dur ? F.dur : Infinity);
  return { sync: it.rec.sync || '', synced: !!syncOf(it), playing: !!it.src, log: L, ctxNow: ctx ? ctx.currentTime : null, now: s, voiceNow: L && ctx ? L.at + (ctx.currentTime - L.c0) : null };
}

// ------------------------------------------------------------------- the card --
// the recorder's voice rows (an object's, a shape's and an empty's card, page and headset): the switch and what it says;
// while a recording runs, its level
function voiceRows(it, B, during) {
  if (!VOICE_KINDS.includes(it.kind)) return;
  if (during) {
    const V = REC && REC.v;
    if (!V) return;
    B.push(V.state === 'on' ? { p: '● Your voice: ' + (V.an ? '●'.repeat(V.lvl) + '○'.repeat(8 - V.lvl) : 'recording'), c: 'red' }
      : V.state === 'asking' ? { p: 'Your voice: asking for the microphone...', c: 'amber' } : { p: 'Your voice is not recorded: ' + (V.err || 'the microphone stopped.'), c: 'amber' });
    return;
  }
  const can = voiceCan();
  B.push({ label: 'With my voice', row: [{ id: 'recvoice', label: VOICE.asking ? 'Asking for the microphone...' : VOICE.on ? 'With my voice: on' : 'With my voice: off', act: 'i:recVoice', on: VOICE.on, dis: !can || VOICE.asking }] });
  if (VOICE.note) B.push({ p: VOICE.note, c: 'amber' });
  else if (!micThere()) B.push({ p: 'This browser cannot record the microphone.', c: 'faint' });
  else if (!canUpload()) B.push({ p: 'Your voice is kept as a sound of the scene: it needs a relay that takes uploads.', c: 'faint' });
  else B.push({ page: true, p: VOICE.on ? 'While it records, so does the microphone: kept as a sound that follows it and plays with its path, for everyone.' : 'On: the microphone records while it does, kept as a sound that follows it and plays with its path.', c: 'faint' },
    { xr: true, p: 'In a headset the browser may not show its question about the microphone: turn this on on the 2D page first, before entering VR (untested on a Quest).', c: 'faint' });
  const vs = voiceOf(it.id);
  if (vs) B.push({ p: `Its voice: ${vs.rec.name}. Record again with your voice on to replace its sound.`, c: 'muted' });
}
// a sound that plays with a path, on its own card
function syncBlocks(it, B) {
  const r = it.rec;
  if (!r.sync) return;
  const ob = STU.items.get(r.sync), P = ob ? pathOf(ob) : null;
  if (!ob) B.push({ p: 'Recorded with a movement whose item is not in the scene: no longer synced, it plays as a sound of its own (Plays below).', c: 'amber' });
  else if (!P) B.push({ p: `Recorded with ${ob.rec.name}'s movement, which has no recorded path now: no longer synced, it plays as a sound of its own (Plays below). Record ${ob.rec.name}'s movement again with your voice to sync it again.`, c: 'amber' });
  else B.push({ p: `Plays with ${ob.rec.name}'s recorded path: from each start of it (${P.play === 'once' ? 'once, as it plays once' : P.play === 'bounce' ? 'on the way there' : 'each loop'}), on its clock, so everyone at a circle hears it at the same moment.` + (P.speed !== 1 ? ` At ×${P.speed} the voice plays at its own pace from each start.` : '') + ((r.skip || 0) > 0 ? ` It starts ${secs(r.skip)} into its file.` : ''), c: 'muted' });
}
ITEM_ACT.recVoice = () => voiceSwitch();
PANE_ONLY.push('recVoice');

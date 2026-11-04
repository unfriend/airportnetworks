// ================================================================= UPLOAD ==
// GLB first (tools/studio/SPEC.md, "GLB first, and converting" and "The upload page"). What the studio makes goes into
// folders of the scene: models/ (GLB), sounds/ and originals/ (the files as they were given, so a model can be converted
// again). A GLB the converter wrote records what it was made from (asset.extras.studio): read from its head (a byte
// range) so the Add list shows the GLB and folds the original under Originals. Convert to GLB (an object's card, and
// Convert every model under Add) converts a model of the scene in this page and, with a relay that takes uploads, puts it
// in models/ and switches every object placed from the original to it where it stands (s' = s / b, q' = q * r^-1: one
// change, one Undo step); else it is downloaded. The Upload pane (pages only) takes files and folders dropped onto it,
// shows the plan (one row per thing it will make), then converts and uploads them: models to models/<name>.glb, sounds
// to sounds/ (mono: short ones WAV, long ones MP3 through the relay's ffmpeg), and everything given to originals/.

// ---------------------------------------------------------- GLB records --
const GLBREC = new Map();   // path -> { at, rec (null: none), p (a read under way) }
// a GLB's record: the object (from, s, q, at, scan), null (none), or undefined (not read yet: a read starts)
function glbRec(path) {
  const f = STU.fileMap.get(path);
  if (!f || extOf(path) !== 'glb') return undefined;
  const c = GLBREC.get(path);
  if (c && c.at === f.at) return c.p ? undefined : c.rec;
  if (SRC.held || STU.listing !== 'ok') return undefined;
  const e = { at: f.at, rec: null, p: null }, scene = STU.scene;
  GLBREC.set(path, e);
  e.p = glbHead(path).then(j => { e.rec = CONV.glbRecord(j); }, () => { /* none read: by its name */ })
    .then(() => { e.p = null; if (scene === STU.scene) { STU.libRev++; dirty(); } });
  return undefined;
}
// a GLB's JSON chunk, from its first bytes (a range: a scan's GLB is megabytes, its JSON a few KB)
async function glbHead(path) {
  const part = async (a, b) => {
    const r = await call(fileUrl(path), { headers: { Range: `bytes=${a}-${b}` }, cache: 'no-cache' });
    if (!r.body || !r.body.getReader) return new Uint8Array(await r.arrayBuffer()).subarray(r.status === 206 ? 0 : a);
    // (a server that sends the whole file anyway: read only as far as needed)
    const rd = r.body.getReader(), want = b - a + 1, from = r.status === 206 ? 0 : a, parts = [];
    let n = 0;
    while (n < from + want) { const { done, value } = await rd.read(); if (done) break; parts.push(value); n += value.length; }
    try { rd.cancel(); } catch (e) { /* done */ }
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out.subarray(from, from + want);
  };
  let u8 = await part(0, 65535);
  if (u8.length < 20) return null;
  const len = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(12, true);
  if (len > 8 << 20) return null;
  if (20 + len > u8.length) { const rest = await part(u8.length, 19 + len), all = new Uint8Array(20 + len); all.set(u8); all.set(rest, u8.length); u8 = all; }
  return CONV.glbJSON(u8.slice(0, 20 + len).buffer);
}
// the scene's models a GLB stands for: original path -> GLB path. A GLB's record names what it was made from; a GLB
// without one (or not read yet) stands for a model of the same base name. GLBs under originals/ stand for nothing
function glbFor() {
  const map = new Map(), glbs = STU.files.filter(f => extOf(f.path) === 'glb' && !inOriginals(f.path));
  for (const g of glbs) { const r = glbRec(g.path); if (r && r.from && r.from !== g.path && STU.fileMap.has(r.from)) map.set(r.from, g.path); }
  for (const g of glbs) {
    const r = glbRec(g.path);
    if (r && r.from) continue;
    const st = stem(g.path).toLowerCase();
    for (const f of STU.files) if (f.kind === 'model' && extOf(f.path) !== 'glb' && stem(f.path).toLowerCase() === st && !map.has(f.path)) map.set(f.path, g.path);
  }
  return map;
}
const inOriginals = p => /^originals\//i.test(p);
// what the scene's folders hold: models and sounds to place (models/, sounds/, anything outside originals/; an original a
// GLB stands for goes under Originals, with the GLB placed for it), and the Originals fold
function sceneLists() {
  const stands = glbFor(), models = [], sounds = [], orig = [];
  for (const f of STU.files) {
    const o = inOriginals(f.path);
    if (o || (f.kind === 'model' && stands.has(f.path))) orig.push(f);
    else if (f.kind === 'model') models.push(f);
    else if (f.kind === 'audio') sounds.push(f);
  }
  return { models, sounds, orig, stands };
}

// --------------------------------------------------------- Convert to GLB --
// A model of the scene converted in this page (the converter, engine/convert.js): fetched again and loaded afresh (the
// placed one is left alone), given the studio's guess, its textures at most 2,048 px (For Quest) or 4,096, written as a
// GLB, loaded back and checked. With a relay that takes uploads it goes to models/<base name>.glb (again for one made
// from this file before, else a free name) and every object placed from the original switches to it; else it is
// downloaded. A failure changes nothing
const CV = { busy: '', note: '', noteC: 'muted', done: [], all: null };
const canConvert = p => STU.fileMap.has(p) && MODEL_EXT.includes(extOf(p)) && editOn() && !XR.on;
const canUpload = () => SRC.kind === 'relay' && SRC.upload && SRC.save && !SRC.held && !OPT.visit;
const maxTexNow = () => (UP.quest ? 2048 : 4096);
async function convertFile(path) {
  if (!canConvert(path) || CV.busy) return false;
  const name = stem(path), scene = STU.scene, gen = STU.gen;
  CV.busy = path; CV.note = `Converting ${baseName(path)}: reading it...`; CV.noteC = 'muted'; dirty(true);
  let ok = false;
  try {
    const buf = await getBytes(fileUrl(path));
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '', base = sceneUrl(scene) + encPath(dir);
    await new Promise(r => later(r, 30));
    const m = await CONV.load({ ext: extOf(path), data: buf, base, name, url: u => resolveUrl(u, base, dir, new Set()) });
    const r = await CONV.toGLB(m, { name, maxTex: maxTexNow(), from: path, step: l => { CV.note = `Converting ${baseName(path)}: ${l.toLowerCase()}...`; dirty(); } });
    CONV.disposeTree(m.root);
    STUDIO.lastGLB = { name: name + '.glb', glb: r.glb, record: r.record, ok: r.ok, why: r.why, notes: r.notes, before: r.before, after: r.after };
    if (gen !== STU.gen || GL.gone) return false;
    if (!r.ok) { CV.note = `${baseName(path)} was not converted (nothing changed): ${r.why}.`; CV.noteC = 'red'; return false; }
    const size = mb(r.glb.byteLength), lost = r.missing.length ? ` It lacks ${r.missing.join(', ')}.` : '';
    if (canUpload()) {
      // (models/<base>.glb: replaced when it was made from this very file, else the next free name)
      let out = 'models/' + safeSeg(name) + '.glb', replace = false;
      if (STU.fileMap.has(out)) { const rec = glbRec(out) || (await glbHead(out).then(j => CONV.glbRecord(j), () => null)); if (rec && rec.from === path) replace = true; else out = freeName(out, p => STU.fileMap.has(p)); }
      CV.note = `Converting ${baseName(path)}: uploading ${out} (${size})...`; dirty();
      const j = await upSend(fileApi(scene, out, replace), new Blob([r.glb], { type: 'model/gltf-binary' }), p => { CV.note = `Converting ${baseName(path)}: uploading ${out} (${Math.round(p * 100)} %)...`; dirty(); });
      out = (j && j.path) || out;
      if (gen !== STU.gen) return false;
      await refreshFiles(new Set([out]));
      const f = STU.fileMap.get(out);
      GLBREC.set(out, { at: f ? f.at : 0, rec: r.record, p: null });
      const n = switchToGLB(path, out, r.record);
      CV.note = `${baseName(path)} is now ${out} (${size}, textures at most ${fmt(maxTexNow())} px)` + (n ? `: ${n} object${n === 1 ? '' : 's'} switched to it where ${n === 1 ? 'it stands' : 'they stand'}.` : '.') + lost;
      CV.noteC = 'green';
      CV.done.push(out);
    } else {
      saveFile(r.glb, name + '.glb', 'model/gltf-binary');
      CV.note = `${baseName(path)} converted (${size}) and downloaded as ${name}.glb: ` + (SRC.kind === 'relay' ? 'this relay does not take uploads; ' : '') + 'put it in the scene\'s models/ folder.' + lost;
      CV.noteC = 'green';
      CV.done.push(name + '.glb');
    }
    ok = true;
    sfxAct('ping', 'stage', 'centre', { gain: 0.6 });
  } catch (e) {
    if (gen === STU.gen) { CV.note = `${baseName(path)} was not converted (nothing changed): ${e.status === 401 ? AUTH_NOTE : e.message}`; CV.noteC = 'red'; }
  } finally { CV.busy = ''; dirty(true); }
  return ok;
}
// Convert every model (Add): each model to place that is not a GLB, one after another
async function convertAll() {
  if (CV.busy || CV.all) return;
  const list = sceneLists().models.filter(f => extOf(f.path) !== 'glb').map(f => f.path);
  CV.all = { i: 0, n: list.length, ok: 0 };
  try { for (const p of list) { CV.all.i++; if (await convertFile(p)) CV.all.ok++; if (!editOn()) break; } } finally {
    const a = CV.all;
    CV.all = null;
    if (a.n > 1) { CV.note = `Converted ${a.ok} of ${a.n} models.` + (a.ok < a.n ? ' ' + CV.note : ''); CV.noteC = a.ok === a.n ? 'green' : 'amber'; }
    dirty(true);
  }
}
// Every object placed from `orig` now placed from the GLB where it stands: the GLB holds the original turned by r and
// scaled by b (its record), so the object's own scale and turn become s / b and q * r^-1 (one change, one Undo step,
// for everyone at a station). A GLB with no record is taken as the studio's own guess for the original made into metres
// and Y up
function switchToGLB(orig, glb, rec) {
  if (!editOn()) return 0;
  const E = LIB.get(orig), g = rec || (E && E.guess) || { s: 1, q: [0, 0, 0, 1] };
  const list = [...STU.items.values()].filter(it => it.kind === 'o' && it.rec.file === orig);
  if (!list.length) return 0;
  change(() => { for (const it of list) setRec(it.id, switchedRec(it.rec, glb, g)); });
  sfxAct('rise', 'stage', 'centre', { dur: 0.5, gain: 0.5 });
  return list.length;
}
const switchedRec = (r, glb, g) => {
  const ri = new THREE.Quaternion().fromArray(g.q).normalize().invert(), q = new THREE.Quaternion().fromArray(r.q).multiply(ri).normalize();
  return { file: glb, s: r.s / (g.s || 1), q: q.toArray() };
};
// a file for this computer (the converted GLB without a relay; the Upload pane's outputs)
function saveFile(data, name, type) {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: type || 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  later(() => URL.revokeObjectURL(url), 60000);
}

// ------------------------------------------------------------- the relay --
// a scene's file, as the upload endpoint takes it (the relay's rules: relay/scenes.mjs, uploadPath)
const fileApi = (scene, p, replace) => `${SRC.base}/api/scenes/${encodeURIComponent(scene)}/file?path=${encodeURIComponent(p)}${replace ? '&replace=1' : ''}`;
const soundApi = (scene, p, replace) => `${SRC.base}/api/scenes/${encodeURIComponent(scene)}/sound?path=${encodeURIComponent(p)}${replace ? '&replace=1' : ''}`;
// one upload, with its progress (an XMLHttpRequest: fetch says nothing of what has gone); the password as a header, a
// refusal told to the shell once (authHold, as every call)
function upSend(url, body, onP) {
  return new Promise((res, rej) => {
    if (SRC.held) { rej(AUTH_ERR()); return; }
    const x = new XMLHttpRequest();
    x.open('POST', url);
    x.setRequestHeader('Content-Type', 'application/octet-stream');
    if (SRC.token) x.setRequestHeader('Authorization', 'Bearer ' + SRC.token);
    if (onP) x.upload.onprogress = e => { if (e.lengthComputable) onP(e.loaded / Math.max(1, e.total)); };
    x.onload = () => {
      let j = null;
      try { j = JSON.parse(x.responseText); } catch (e) { /* not JSON */ }
      if (x.status === 401) { if (!SRC.held) { saw(401, SRC.token, j); authHold(); } rej(AUTH_ERR()); return; }
      saw(x.status, SRC.token, x.status < 300 ? null : j);
      if (x.status >= 200 && x.status < 300) res(j);
      else rej(Object.assign(new Error((j && j.error) || 'HTTP ' + x.status), { status: x.status, retry: +x.getResponseHeader('Retry-After') || 0 }));
    };
    x.onerror = () => rej(Object.assign(new Error('the relay could not be reached'), { status: 0 }));
    x.send(body);
  });
}
// a path part the relay takes as it is (no characters a common file system cannot keep, no dot at the start, none of
// its device names, nothing that reads as a temporary file)
function safeSeg(s) {
  s = String(s).replace(/[\0-\x1f\x7f\\/:*?"<>|]/g, '_');
  // (a long name shortened keeps its extension: what kind of file it is goes by it)
  if (s.length > 90) { const dot = s.lastIndexOf('.'), ext = dot > 0 && s.length - dot <= 12 ? s.slice(dot) : ''; s = s.slice(0, 90 - ext.length) + ext; }
  s = s.replace(/^[. ]+/, m => '_'.repeat(m.length)).replace(/[. ]+$/, m => '_'.repeat(m.length));
  if (/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(s)) s = '_' + s;
  if (/(~|\.(tmp|temp|part|partial|crdownload|download|swp|swx))$/i.test(s)) s += '_';
  return s || '_';
}
// the next free name: "eva_001.glb", "eva_001 2.glb", ...
function freeName(p, taken) {
  if (!taken(p)) return p;
  const i = p.lastIndexOf('/'), dir = p.slice(0, i + 1), f = p.slice(i + 1), dot = f.lastIndexOf('.'), b = dot > 0 ? f.slice(0, dot) : f, e = dot > 0 ? f.slice(dot) : '';
  for (let n = 2; ; n++) { const q = `${dir}${b} ${n}${e}`; if (!taken(q)) return q; }
}

// ---------------------------------------------------------------- sounds --
// A sound's own sample rate, from its header (WAV, FLAC, AIFF, Ogg, MP3, ADTS AAC, MP4/M4A): a short one is written at
// it (at most 48 kHz); 0 when it cannot be told
function rateOf(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), str = (o, n) => String.fromCharCode.apply(null, u8.subarray(o, o + n));
  try {
    if (str(0, 4) === 'RIFF' && str(8, 4) === 'WAVE') for (let o = 12; o + 16 <= u8.length;) { const n = dv.getUint32(o + 4, true); if (str(o, 4) === 'fmt ') return dv.getUint32(o + 12, true); o += 8 + n + (n & 1); }
    if (str(0, 4) === 'fLaC') return (u8[18] << 12) | (u8[19] << 4) | (u8[20] >> 4);
    if (str(0, 4) === 'FORM' && /^AIF[FC]$/.test(str(8, 4))) for (let o = 12; o + 26 <= u8.length;) {
      const n = dv.getUint32(o + 4, false);
      if (str(o, 4) === 'COMM') { const e = dv.getUint16(o + 16, false) & 0x7fff, m = dv.getUint32(o + 18, false); return Math.round(m * Math.pow(2, e - 16383 - 31)); }
      o += 8 + n + (n & 1);
    }
    const head = str(0, Math.min(u8.length, 4096));
    if (head.startsWith('OggS')) { const v = head.indexOf('\x01vorbis'); if (v >= 0) return dv.getUint32(v + 12, true); if (head.includes('OpusHead')) return 48000; }
    const mp4 = head.indexOf('mp4a');
    if (mp4 > 4 && mp4 + 32 <= u8.length && /ftyp/.test(head)) return dv.getUint32(mp4 + 28, false) >>> 16;
    let o = 0;
    if (str(0, 3) === 'ID3') o = 10 + ((u8[6] & 127) << 21 | (u8[7] & 127) << 14 | (u8[8] & 127) << 7 | (u8[9] & 127));
    for (const end = Math.min(u8.length - 4, o + 65536); o < end; o++) {
      if (u8[o] !== 0xff || (u8[o + 1] & 0xe0) !== 0xe0) continue;
      const b1 = u8[o + 1], b2 = u8[o + 2];
      if ((b1 & 0xf6) === 0xf0) { const r = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350][(b2 >> 2) & 15]; if (r) return r; continue; }   // ADTS (AAC)
      const ver = (b1 >> 3) & 3, layer = (b1 >> 1) & 3, ri = (b2 >> 2) & 3;
      if (ver === 1 || layer === 0 || ri === 3) continue;
      return [[11025, 12000, 8000], null, [22050, 24000, 16000], [44100, 48000, 32000]][ver][ri];
    }
  } catch (e) { /* not told */ }
  return 0;
}
// a sound decoded and mixed to mono at `rate` (an OfflineAudioContext only decodes: it opens no output, so the rule that
// sound is the shell's is kept), as a 16-bit WAV
async function monoWav(bytes, rate) {
  let ctx;
  try { ctx = new OfflineAudioContext(1, 1, rate); } catch (e) { ctx = new OfflineAudioContext(1, 1, 44100); }
  const b = await ctx.decodeAudioData(bytes.slice(0)), n = b.length, ch = b.numberOfChannels, mix = new Float32Array(n);
  for (let c = 0; c < ch; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) mix[i] += d[i] / ch; }
  const out = new ArrayBuffer(44 + n * 2), dv = new DataView(out), w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, b.sampleRate, true); dv.setUint32(28, b.sampleRate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, mix[i])) * 32767), true);
  return { wav: out, rate: b.sampleRate, dur: b.duration, ch };
}
// how long a dropped sound is, from an <audio> element's metadata (NaN: this browser cannot read it)
function probeFile(file) {
  return new Promise(res => {
    const el = new Audio(), url = URL.createObjectURL(file);
    let done = false;
    const end = d => { if (done) return; done = true; unlater(t); el.removeAttribute('src'); try { el.load(); } catch (e) { /* gone */ } URL.revokeObjectURL(url); res(d); };
    const t = later(() => end(NaN), 15000);
    el.preload = 'metadata';
    el.addEventListener('loadedmetadata', () => end(el.duration));
    el.addEventListener('error', () => end(NaN));
    el.src = url;
  });
}

// ----------------------------------------------------------- the Upload pane --
// UP.entries: what was dropped ({ path in the dropped folders, file, ext, name }); UP.rows: the plan, one row per thing it
// will make ({ kind: 'model' | 'sound' | 'keep', main, src: entries, out: paths, notes, state, p, msg, dl })
const UP = { scene: '', newOpen: false, newName: '', making: false, newNote: '', entries: [], rows: [], left: [], quest: true, replace: false, busy: false, ran: false, note: '', gen: 0, have: null, haveFor: '', planning: false, rev: 0, blobs: [], sent: new Set() };
const SOUND_EXT = ['mp3', 'ogg', 'oga', 'wav', 'm4a', 'aac', 'flac', 'opus', 'webm', 'aif', 'aiff', 'aifc'];
const KEEP_AS_IS = ['mp3', 'm4a', 'aac', 'ogg', 'oga'];
const JUNK = /^(\.|thumbs\.db$|desktop\.ini$)/i;
const upRelay = () => SRC.kind === 'relay' && SRC.upload && SRC.state === 'ok';
const upChanged = () => { UP.rev++; dirty(); };
// files dropped or chosen: [{ path, file }] (a dropped folder's structure kept in path)
function upTake(list) {
  if (UP.busy) return;
  const out = [], left = [];
  for (const x of list) {
    const path = String(x.path || x.file.name).replace(/\\/g, '/').replace(/^\/+/, ''), name = baseName(path);
    if (!name || path.split('/').some(s => JUNK.test(s))) { left.push(name || path); continue; }
    if (out.length >= 2000) break;
    out.push({ path, file: x.file, ext: extOf(name), name, buf: null });
  }
  UP.entries = out; UP.left = left; UP.ran = false; UP.note = ''; UP.sent = new Set();
  for (const u of UP.blobs) URL.revokeObjectURL(u);
  UP.blobs = [];
  if (!UP.scene) UP.scene = STU.scene || (SRC.scenes.length === 1 ? SRC.scenes[0].name : '');
  X.tab = 'upload';
  upPlan();
}
// the plan: each model with the files it names (found by base name, case aside, anywhere in what was dropped: its
// textures, an OBJ's MTL and the MTL's textures, a glTF's .bin), each sound on its own, and anything left kept as it is
async function upPlan() {
  const gen = ++UP.gen, E = UP.entries, byName = new Map();
  UP.planning = true; upChanged();
  if (UP.haveFor !== UP.scene || !UP.have) await upHave();   // (names numbered against what the scene holds, from the first plan)
  if (gen !== UP.gen) return;
  for (const e of E) { const k = e.name.toLowerCase(); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(e); }
  // (the nearest of several by that name: in the model's own folder first)
  const find = (n, near) => { const L = byName.get(baseName(n).toLowerCase()); if (!L) return null; const dir = near.path.slice(0, near.path.lastIndexOf('/') + 1); return L.find(e => e.path.startsWith(dir) && e.path.slice(dir.length) === baseName(n)) || L.find(e => e.path.startsWith(dir)) || L[0]; };
  const used = new Set(), rows = [];
  for (const e of E.filter(x => MODEL_EXT.includes(x.ext))) {
    const r = { kind: 'model', main: e, src: [e], out: [], notes: [], state: 'plan', p: 0, msg: '', dl: [], title: e.path };
    used.add(e);
    try {
      if (!e.buf) e.buf = await e.file.arrayBuffer();
      if (gen !== UP.gen) return;
      const N = CONV.namesIn(e.ext, e.buf), lost = [];
      const attach = n => { const f = find(n, e); if (f) { if (!r.src.includes(f)) r.src.push(f); used.add(f); return f; } if (!lost.includes(n)) lost.push(n); return null; };
      for (const n of N.mtl) {
        const f = attach(n);
        if (f) { const txt = await f.file.text(); for (const t of CONV.mtlNames(txt)) attach(t); }
      }
      for (const n of N.buffers) attach(n);
      for (const n of N.textures) attach(n);
      if (lost.length) r.notes.push(e.ext === 'fbx' ? `Names ${lost.join(', ')}, not among the files (perhaps inside the FBX: the row says after converting)` : `Missing ${lost.join(', ')}: converted without ${lost.length > 1 ? 'them' : 'it'}`);
    } catch (err) { r.notes.push('It could not be read: ' + err.message); }
    finally { e.buf = null; }   // (read again when its row runs: a folder of large scans is never all in memory at once)
    rows.push(r);
  }
  for (const e of E.filter(x => SOUND_EXT.includes(x.ext) && !used.has(x))) { used.add(e); rows.push({ kind: 'sound', main: e, src: [e], out: [], notes: [], state: 'plan', p: 0, msg: 'Measuring...', dl: [], title: e.path, dur: undefined, rate: 0 }); }
  for (const e of E.filter(x => !used.has(x))) rows.push({ kind: 'keep', main: e, src: [e], out: [], notes: [], state: 'plan', p: 0, msg: '', dl: [], title: e.path });
  if (gen !== UP.gen) return;
  UP.rows = rows;
  upNames();
  UP.planning = false; upChanged();
  // the sounds' lengths and rates (an element's metadata, the header's first bytes), then the names again
  for (const r of rows.filter(x => x.kind === 'sound')) {
    const [dur, head] = await Promise.all([probeFile(r.main.file), r.main.file.slice(0, 1 << 18).arrayBuffer()]);
    if (gen !== UP.gen) return;
    r.dur = dur; r.rate = rateOf(new Uint8Array(head)); r.msg = '';
    upNames(); upChanged();
  }
}
// where each row's files go in the scene, against what the scene holds (numbered unless Replace) and each other
async function upHave() {
  const name = UP.scene;
  if (!name || !upRelay()) { UP.have = []; UP.haveFor = name; return; }
  if (name === STU.scene && STU.listing === 'ok') { UP.have = STU.files.map(f => f.path); UP.haveFor = name; return; }
  try { const j = await getJSON(`${SRC.base}/api/scenes/${encodeURIComponent(name)}`); if (UP.scene === name) { UP.have = (j.files || []).map(f => f.path); UP.haveFor = name; } } catch (e) { UP.have = []; UP.haveFor = name; }
}
function origPath(path) {
  const segs = path.split('/').map(safeSeg), file = segs.pop(), dirs = segs.slice(-3);   // (the relay keeps 4 folders: originals/ and 3 of the dropped ones)
  const p = ['originals', ...dirs, file].join('/');
  return p.length <= 200 ? p : 'originals/' + file.slice(0, 180);
}
function upNames() {
  const have = new Set((UP.have || []).map(p => p.toLowerCase())), mine = new Set(), given = new Map();
  const taken = p => mine.has(p.toLowerCase()) || (!UP.replace && have.has(p.toLowerCase()));
  const claim = p => { const q = freeName(p, taken); mine.add(q.toLowerCase()); return q; };
  const orig = e => { if (!given.has(e)) given.set(e, claim(origPath(e.path))); return given.get(e); };
  const relay = upRelay() && !!UP.scene;
  // a row already run (made, or failed and run again) keeps its names: what it made is not renamed, and what it sent is
  // not sent again under another name (the files this upload wrote are in the scene's listing by now)
  for (const r of UP.rows) {
    if (r.state === 'plan') continue;
    for (const p of r.out) mine.add(p.toLowerCase());
    const kept = r.kind === 'model' ? r.src.map((e, i) => [e, r.out[i + 1]]) : [[r.main, r.out[r.out.length - 1]]];
    for (const [e, p] of kept) if (p && !given.has(e)) given.set(e, p);
  }
  for (const r of UP.rows) {
    if (r.state !== 'plan') continue;
    r.out = []; r.how = '';
    const st = safeSeg(r.main.name.replace(/\.[^.]*$/, ''));
    if (r.kind === 'model') { r.out.push(claim(`models/${st}.glb`)); r.from = orig(r.main); for (const e of r.src) r.out.push(orig(e)); }
    else if (r.kind === 'sound') {
      const d = r.dur;
      if (d === undefined) r.how = 'measuring';
      else if (!(d > 0) || !isFinite(d)) { r.how = 'unread'; r.out.push(orig(r.main)); continue; }
      else if (d <= STREAM_S) r.how = 'wav';
      else if (relay && SRC.ffmpeg) r.how = 'mp3';
      else if (KEEP_AS_IS.includes(r.main.ext)) r.how = 'keep';
      else r.how = 'wav22';
      if (r.how !== 'measuring') r.out.push(claim(`sounds/${st}.${r.how === 'mp3' ? 'mp3' : r.how === 'keep' ? r.main.ext : 'wav'}`));
      r.out.push(orig(r.main));
    } else r.out.push(orig(r.main));
  }
}
// what a row says it will make, in words
function rowPlan(r) {
  const d = r.dur, len = d > 0 && isFinite(d) ? (d >= 60 ? `${Math.floor(d / 60)} min ${Math.round(d % 60)} s` : `${d.toFixed(d < 10 ? 1 : 0)} s`) : '';
  if (r.kind === 'model') {
    const more = r.src.length - 1;
    return `A model: ${r.out[0]} (metres, Y up, textures at most ${fmt(maxTexNow())} px)` + (more ? `, with ${more} file${more === 1 ? '' : 's'} it names` : '') + '; the given files to originals/.';
  }
  if (r.kind === 'sound') {
    const rate = Math.min(48000, r.rate || 44100);
    return r.how === 'measuring' ? 'A sound: measuring its length...'
      : r.how === 'unread' ? 'This browser cannot read this sound: kept as it is in originals/.'
      : r.how === 'wav' ? `A short sound (${len}): ${r.out[0]}, mono, 16-bit, ${(rate / 1000).toFixed(rate % 1000 ? 2 : 0)} kHz (loops without a gap).`
      : r.how === 'mp3' ? `A long sound (${len}): ${r.out[0]}, made mono MP3 by the relay's ffmpeg (streamed when played).`
      : r.how === 'keep' ? `A long sound (${len}): ${r.out[0]} kept as it is (a stereo file plays from one point; no ffmpeg on ${upRelay() ? 'this relay' : 'a page alone'}).`
      : `A long sound (${len}): ${r.out[0]}, mono WAV at ${r.rate && r.rate < 22050 ? (r.rate / 1000).toFixed(r.rate % 1000 ? 2 : 0) : '22.05'} kHz (no ffmpeg ${upRelay() ? 'on this relay' : 'without a relay'} to make an MP3).`;
  }
  return 'Kept as it is: to originals/ (no model names it).';
}
// a new scene (POST /api/scenes): its folder made, then picked
async function upMake() {
  const name = UP.newName.trim();
  // (the relay's rule for a new scene: relay/scenes.mjs, newSceneName)
  if (!okScene(name) || name === 'watch' || /[ .]$/.test(name) || /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(name)) { UP.newNote = 'A scene\'s name: up to 64 letters, digits, spaces, _ . or -, not starting with a space, . or -, not ending in a dot, and not a device name (con, nul...).'; dirty(true); return; }
  if (!upRelay() || UP.making) return;
  UP.making = true; UP.newNote = ''; dirty(true);
  try {
    await getJSON(`${SRC.base}/api/scenes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    UP.scene = name; UP.newOpen = false; UP.newName = '';
    await listScenes(SRC.gen);
    await upHave(); upNames();
  } catch (e) { UP.newNote = e.status === 409 ? `There is a scene called ${name} already: pick it above.` : 'The scene could not be made: ' + e.message; }
  finally { UP.making = false; dirty(true); }
}
async function upPick(name) { if (UP.busy) return; UP.scene = name; UP.rev++; await upHave(); upNames(); dirty(true); }
// Convert and upload (or, with no relay that takes uploads, Convert: the outputs offered as downloads)
async function upRun() {
  if (UP.busy || !UP.rows.length) return;
  const relay = upRelay();
  if (relay && !UP.scene) { UP.note = 'Pick a scene first, or make a new one.'; dirty(true); return; }
  UP.busy = true; UP.ran = true; UP.note = ''; dirty(true);
  const gen = UP.gen, scene = UP.scene, sent = UP.sent;   // (what this upload has sent, across runs: a run again sends only the rest)
  try {
    if (relay) { await upHave(); upNames(); }
    for (const r of UP.rows) {
      if (gen !== UP.gen || GL.gone) return;
      if (r.state === 'done') continue;
      r.state = 'work'; r.p = 0; r.msg = ''; r.dl = []; upChanged();
      try { await upRow(r, relay, scene, sent); }
      catch (e) { r.state = 'failed'; r.msg = e.status === 401 ? AUTH_NOTE : (r.msg ? r.msg + ' ' : '') + 'It failed: ' + e.message; if (e.status === 401) break; }
      upChanged();
    }
    const bad = UP.rows.filter(r => r.state === 'failed').length;
    UP.note = relay ? (bad ? `Done, with ${bad} row${bad === 1 ? '' : 's'} not made (said in each).` : `Done: everything is in the scene ${scene}.`)
      : 'Converted here: download what was made (nothing was uploaded: no relay takes uploads here).';
    if (relay && scene === STU.scene) refreshFiles(new Set());
    if (relay) listScenes(SRC.gen);
  } finally { UP.busy = false; dirty(true); }
}
// one row: converted (a model, a sound) and its files uploaded, the given ones to originals/ (each once a run)
async function upRow(r, relay, scene, sent) {
  const prog = (a, b) => f => { r.p = a + (b - a) * f; dirty(); };
  const keep = async (e, p) => {
    const key = scene + '\0' + p;
    if (!relay || !p || sent.has(key)) return;
    r.msg = `Uploading ${p}...`; upChanged();
    await upFile(scene, p, e.file, prog(r.p, Math.min(1, r.p + 0.15)));
    sent.add(key);
  };
  if (r.kind === 'keep' || (r.kind === 'sound' && r.how === 'unread')) {
    if (relay) await keep(r.main, r.out[0]);
    r.state = 'done'; r.p = 1; r.msg = relay ? `In ${r.out[0]}.` : 'Kept as it is (with a relay it goes to originals/).';
    return;
  }
  if (r.kind === 'model') {
    const e = r.main, glbPath = r.out[0], urls = new Map();
    for (const f of r.src) { const u = URL.createObjectURL(f.file); UP.blobs.push(u); urls.set(f.path.toLowerCase(), u); if (!urls.has(f.name.toLowerCase())) urls.set(f.name.toLowerCase(), u); }
    const dir = e.path.includes('/') ? e.path.slice(0, e.path.lastIndexOf('/') + 1) : '', base = 'upload:/' + dir;
    const url = u => {
      let rel = u.startsWith(base) ? u.slice(base.length) : u;
      try { rel = decodeURIComponent(rel); } catch (err) { /* as it is */ }
      rel = rel.split(/[?#]/)[0].replace(/\\/g, '/').replace(/^(\.\/)+/, '');
      return urls.get((dir + rel).toLowerCase()) || urls.get(baseName(rel).toLowerCase()) || null;
    };
    r.msg = 'Reading it...'; r.p = 0.02; upChanged();
    if (!e.buf) e.buf = await e.file.arrayBuffer();
    await new Promise(res => later(res, 30));
    let res = null;
    try {
      const m = await CONV.load({ ext: e.ext, data: e.buf, base, name: e.name.replace(/\.[^.]*$/, ''), url });
      res = await CONV.toGLB(m, { name: e.name.replace(/\.[^.]*$/, ''), maxTex: maxTexNow(), from: r.from, step: (l, f) => { r.msg = l + '...'; r.p = 0.05 + f * 0.5; dirty(); } });
      CONV.disposeTree(m.root);
    } catch (err) { res = { ok: false, why: whyFailed(err).replace(/\.$/, ''), notes: [], missing: [] }; }
    e.buf = null;
    for (const m of res.missing || []) r.notes.push(`Converted without its texture ${m}.`);
    if (res.notes) for (const n of res.notes) if (/^made opaque|^no normals/.test(n)) r.notes.push(n.charAt(0).toUpperCase() + n.slice(1) + '.');
    r.notes = [...new Set(r.notes.filter(n => !/^Names .* not among the files/.test(n) || !res.ok))];
    // the given files kept whether or not it converted (a failure is said; the original can be tried again)
    r.p = 0.55;
    for (const f of r.src) await keep(f, r.out[r.src.indexOf(f) + 1]);
    if (!res.ok) { r.state = 'failed'; r.msg = `Not converted: ${res.why}.` + (relay ? ' Its files are kept in originals/.' : ''); return; }
    const size = mb(res.glb.byteLength);
    if (relay) {
      r.msg = `Uploading ${glbPath} (${size})...`; upChanged();
      const j = await upFile(scene, glbPath, new Blob([res.glb], { type: 'model/gltf-binary' }), prog(0.85, 1));
      r.out[0] = (j && j.path) || glbPath;
      r.msg = `Made ${r.out[0]} (${size}).`;
    } else { r.dl.push({ name: baseName(glbPath), url: blobOf(res.glb, 'model/gltf-binary') }); r.msg = `Converted (${size}).`; }
    r.state = 'done'; r.p = 1;
    return;
  }
  // a sound
  const e = r.main, out = r.out[0];
  if (r.how === 'mp3') {
    r.msg = `The relay's ffmpeg is making ${out}...`; r.p = 0.1; upChanged();
    let j = null;
    for (let k = 0; ; k++) {
      try { j = await upSend(soundApi(scene, out, UP.replace), e.file, prog(0.1, 0.7)); break; }
      catch (err) { if (err.status !== 429 || k > 8) throw err; await new Promise(res => later(res, 1000 * Math.max(2, err.retry || 3))); }
    }
    r.out[0] = (j && j.path) || out;
  } else if (r.how === 'keep') {
    if (relay) await upFile(scene, out, e.file, prog(0.1, 0.7));
  } else {
    r.msg = 'Decoding it...'; r.p = 0.1; upChanged();
    const w = await monoWav(await e.file.arrayBuffer(), Math.min(r.how === 'wav' ? 48000 : 22050, Math.max(8000, r.rate || 44100)));
    if (relay) { r.msg = `Uploading ${out} (${mb(w.wav.byteLength)})...`; upChanged(); await upFile(scene, out, new Blob([w.wav], { type: 'audio/wav' }), prog(0.3, 0.7)); }
    else r.dl.push({ name: baseName(out), url: blobOf(w.wav, 'audio/wav') });
    r.made = `mono, ${w.rate} Hz, ${w.dur.toFixed(1)} s` + (w.ch > 1 ? ` (from ${w.ch} channels)` : '');
  }
  r.p = 0.75;
  await keep(e, r.out[1]);
  r.state = 'done'; r.p = 1;
  r.msg = r.how === 'keep' && !relay ? 'Kept as it is (nothing to convert here).' : relay ? `Made ${r.out[0]}` + (r.made ? ` (${r.made}).` : '.') : `Converted (${r.made}).`;
}
// one file to the scene (409 for a name taken meanwhile: the next free one)
async function upFile(scene, p, body, onP) {
  for (let k = 0; k < 6; k++) {
    try { return await upSend(fileApi(scene, p, UP.replace), body, onP); }
    catch (e) { if (e.status !== 409 || UP.replace) throw e; const was = p; p = freeName(p, q => q === was || (UP.have || []).includes(q)); (UP.have || (UP.have = [])).push(was); }
  }
  throw new Error('no free name for ' + p);
}
// a file the relay would refuse (over its --max-upload), said before anything is sent
const tooBig = r => (upRelay() && SRC.maxUpload ? r.src.filter(e => e.file.size > SRC.maxUpload).map(e => `${e.name} is ${mb(e.file.size)}: more than this relay takes (${mb(SRC.maxUpload)}; --max-upload).`) : []);
const blobOf = (data, type) => { const u = URL.createObjectURL(new Blob([data], { type })); UP.blobs.push(u); return u; };
function upClear() { if (UP.busy) return; UP.gen++; UP.entries = []; UP.rows = []; UP.left = []; UP.ran = false; UP.note = ''; UP.planning = false; UP.sent = new Set(); for (const u of UP.blobs) URL.revokeObjectURL(u); UP.blobs = []; dirty(true); }
function upOpen() {
  const name = UP.scene;
  if (!name) return;
  if (name !== STU.scene) openScene(name, 'pick'); else refreshFiles(new Set());
  if (!OPT.visit && !STU.edit) setEdit(true);
  X.tab = 'add'; dirty(true);
}
// a folder dropped: every file in it (its path kept), read through the browser's entries (at most 2,000 files)
async function readDropped(dt) {
  const out = [], walk = async (en, pre) => {
    if (out.length >= 2000) return;
    if (en.isFile) { try { out.push({ path: pre + en.name, file: await new Promise((res, rej) => en.file(res, rej)) }); } catch (e) { /* unreadable */ } return; }
    if (!en.isDirectory) return;
    const rd = en.createReader();
    for (;;) { const batch = await new Promise(res => rd.readEntries(res, () => res([]))); if (!batch.length) break; for (const c of batch) await walk(c, pre + en.name + '/'); }
  };
  const ents = [...(dt.items || [])].map(i => (i.kind === 'file' && i.webkitGetAsEntry ? i.webkitGetAsEntry() : null));
  if (ents.length && ents.every(Boolean)) { for (const en of ents) await walk(en, ''); return out; }
  return [...(dt.files || [])].map(f => ({ path: f.webkitRelativePath || f.name, file: f }));
}
// the pane's blocks (pages only: a headset shows no Upload tab)
function uploadBlocks(B) {
  const relay = upRelay(), busy = UP.busy;
  B.push({ h: 'Upload', sub: 'Studio' });
  B.push({ p: 'Drop models, textures and sounds here (files or whole folders). Each model is converted to a GLB (metres, Y up, light enough for a headset), each sound made mono, everything sorted into the scene\'s models/, sounds/ and originals/ folders.', c: 'muted' });
  if (relay) {
    B.push({ label: 'Into the scene', row: SRC.scenes.map(s => ({ id: 'up:scene:' + s.name, label: s.name, act: 'up:scene', v: s.name, on: s.name === UP.scene, dis: busy }))
      .concat({ id: 'up:new', label: 'New scene', act: 'up:new', on: UP.newOpen, dis: busy }) });
    if (UP.newOpen) B.push({ input: { id: 'stuNewName', value: UP.newName, ph: 'The new scene\'s name' }, row: [{ id: 'up:make', label: UP.making ? 'Making...' : 'Make it', act: 'up:make', primary: true, dis: UP.making || !UP.newName.trim() }] });
    if (UP.newNote) B.push({ p: UP.newNote, c: 'red' });
    if (!UP.scene) B.push({ p: 'Pick a scene, or make a new one.', c: 'amber' });
  } else {
    B.push({ p: SRC.state === 'auth' ? AUTH_NOTE : SRC.kind === 'relay' && SRC.state === 'ok' ? 'This relay does not take uploads (it runs with --scenes-readonly): you can still convert here and download what is made.'
      : 'No relay that takes uploads: you can still drop files to see the plan, and convert here to download what is made. To upload, run a relay on a computer here:', c: 'amber' });
    if (!(SRC.kind === 'relay' && SRC.state === 'ok')) B.push({ code: 'node relay/server.mjs --lan --scenes <folder>' }, { p: 'Then open its address /upload (each folder in <folder> is a scene; it saves layouts and takes uploads; with ffmpeg installed it makes long sounds MP3).', c: 'faint' });
  }
  B.push({ drop: true, dis: busy });
  B.push({ row: [
    { id: 'up:quest', label: 'For Quest: ' + (UP.quest ? 'on' : 'off'), act: 'up:quest', on: UP.quest, dis: busy },
    { id: 'up:replace', label: 'Replace files with the same name: ' + (UP.replace ? 'on' : 'off'), act: 'up:replace', on: UP.replace, dis: busy || !relay },
  ] }, { p: `For Quest: textures at most ${UP.quest ? '2,048' : '4,096'} px. Replace off: a name taken gets a number (eva_001 2.glb).`, c: 'faint' });
  if (UP.planning) B.push({ p: 'Reading what was dropped...', c: 'faint' });
  if (UP.rows.length) {
    const n = k => UP.rows.filter(r => r.kind === k).length;
    B.push({ label: `The plan: ${n('model')} model${n('model') === 1 ? '' : 's'}, ${n('sound')} sound${n('sound') === 1 ? '' : 's'}, ${n('keep')} kept as ${n('keep') === 1 ? 'it is' : 'they are'}`, plan: UP.rows });
    if (UP.left.length) B.push({ p: `Left out: ${UP.left.length} hidden or system file${UP.left.length === 1 ? '' : 's'} (${UP.left.slice(0, 4).join(', ')}${UP.left.length > 4 ? '...' : ''}).`, c: 'faint' });
    const todo = UP.rows.some(r => r.state !== 'done');
    B.push({ row: [
      { id: 'up:run', label: busy ? 'Working...' : relay ? 'Convert and upload' : 'Convert', act: 'up:run', primary: todo, dis: busy || !todo || (relay && !UP.scene) || UP.rows.some(r => r.how === 'measuring') },
      { id: 'up:clear', label: 'Clear', act: 'up:clear', dis: busy },
      relay && UP.ran && !busy && UP.scene ? { id: 'up:open', label: 'Open the scene', act: 'up:open', primary: !todo } : null,
    ].filter(Boolean) });
  }
  if (UP.note) B.push({ p: UP.note, c: /not made|failed/.test(UP.note) ? 'amber' : 'green' });
  B.push({ p: 'Models: GLB is best (one file, its textures and animations inside); FBX, OBJ with its MTL, glTF, PLY and STL are converted. Textures: JPEG for photos and scans, PNG only where see-through. Sounds: mono places best; short loops become WAV, long ones (over 20 s, streamed) MP3.', c: 'faint' });
}
// the page's HTML for the pane's own blocks: the drop zone, a text field, the plan
function uploadHTML(b) {
  if (b.drop) return `<div class="stu-drop${b.dis ? ' off' : ''}" data-drop="1"><b>Drop files or folders here</b><span>or</span><div class="actions"><button class="btn" type="button" data-act="up:choose" data-v=""${b.dis ? ' disabled' : ''}>Choose files</button><button class="btn" type="button" data-act="up:folder" data-v=""${b.dis ? ' disabled' : ''}>Choose a folder</button></div></div>`;
  if (b.input) return `<div class="actions stu-in"><input type="text" id="${b.input.id}" value="${esc(b.input.value)}" placeholder="${esc(b.input.ph)}" maxlength="64" autocomplete="off">${b.row.map(x => `<button class="btn${x.primary ? ' primary' : ''}" type="button" data-act="${x.act}" data-v=""${x.dis ? ' disabled' : ''} data-id="${esc(x.id)}">${esc(x.label)}</button>`).join('')}</div>`;
  if (b.plan) return `<p class="stu-l">${esc(b.label)}</p><ul class="stu-plan">${b.plan.map(r => {
    const st = { plan: '', work: 'working', done: 'done', failed: 'failed' }[r.state] || '';
    return `<li class="${st}" data-kind="${r.kind}"><span class="k">${{ model: 'Model', sound: 'Sound', keep: 'Kept' }[r.kind]}</span><span class="t">${esc(r.title)}${r.src.length > 1 ? `<small> + ${r.src.slice(1).map(e => esc(e.name)).join(', ')}</small>` : ''}</span>
      <small class="w">${esc(rowPlan(r))}</small>${r.notes.concat(tooBig(r)).map(n => `<small class="n">${esc(n)}</small>`).join('')}
      ${r.state === 'work' || r.state === 'done' ? `<span class="bar"><i style="width:${Math.round(r.p * 100)}%"></i></span>` : ''}${r.msg ? `<small class="m">${esc(r.msg)}</small>` : ''}
      ${r.dl.map(d => `<a class="btn" href="${d.url}" download="${esc(d.name)}">Download ${esc(d.name)}</a>`).join('')}</li>`;
  }).join('')}</ul>`;
  return '';
}
// the page's listeners: files dropped anywhere on the studio's page (the Upload pane opens with them), the file choosers,
// the new scene's name as it is typed
function uploadBind() {
  const ex = $('#explore'), over = ev => !!(ev.dataTransfer && [...(ev.dataTransfer.types || [])].includes('Files'));
  const zone = on => document.querySelectorAll('#explore .stu-drop').forEach(z => z.classList.toggle('hot', on));
  document.addEventListener('dragover', ev => { if (!over(ev) || XR.on || OPT.visit || UP.busy) return; ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; zone(true); });
  document.addEventListener('dragleave', ev => { if (!ev.relatedTarget) zone(false); });
  document.addEventListener('drop', ev => {
    if (!over(ev) || XR.on || OPT.visit) return;
    ev.preventDefault(); zone(false);
    if (UP.busy) return;
    if (APP.mode !== 'explore') APP.enterExplore();
    readDropped(ev.dataTransfer).then(upTake);
  });
  ex.addEventListener('input', ev => { if (ev.target.id === 'stuNewName') { UP.newName = ev.target.value; const b = ex.querySelector('[data-act="up:make"]'); if (b) b.disabled = UP.making || !UP.newName.trim(); } });
  ex.addEventListener('keydown', ev => { if (ev.target.id === 'stuNewName' && ev.key === 'Enter') { ev.preventDefault(); upMake(); } });
  ex.addEventListener('change', ev => {
    const t = ev.target;
    if (t.id !== 'stuFiles' && t.id !== 'stuFolder') return;
    const list = [...(t.files || [])].map(f => ({ path: f.webkitRelativePath || f.name, file: f }));
    t.value = '';
    if (list.length) upTake(list);
  });
}
const UP_ACT = {
  'up:scene': v => upPick(v),
  'up:new': () => { UP.newOpen = !UP.newOpen; UP.newNote = ''; if (UP.newOpen) later(() => { const i = $('#stuNewName'); if (i) i.focus(); }, 50); },
  'up:make': () => upMake(),
  'up:choose': () => { const i = $('#stuFiles'); if (i) i.click(); },
  'up:folder': () => { const i = $('#stuFolder'); if (i) i.click(); },
  'up:quest': () => { UP.quest = !UP.quest; upChanged(); },
  'up:replace': () => { UP.replace = !UP.replace; upNames(); upChanged(); },
  'up:run': () => upRun(),
  'up:clear': () => upClear(),
  'up:open': () => upOpen(),
};

// The developer notebook's store (tools/notes/SPEC.md, "The relay"): a note is a voice recording with what the app knew at
// that moment (pictures, pins, context). Kept in a folder or in an R2 bucket by the same rules: <id>/note.json,
// <id>/audio.<ext>, <id>/shot-1.jpg, <id>/shot-2.jpg. Node's own modules only. Nothing of a note's content is ever logged
// by the callers: this file never logs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const MAX_BODY = 16 << 20, MAX_NOTES = 2000, MAX_UPDATE = 256 << 10, MAX_TRANSCRIPT = 200 << 10, MAX_CONTEXT = 1 << 20;
export const NOTE_ID = /^\d{8}-\d{6}-[a-z0-9]{4}$/;
export const NOTE = 'note.json';
export const NONCE = /^[A-Za-z0-9]{16}$/;
// the audio types a note may carry, by their base type, and the file extension each is kept under
const AUDIO_EXT = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'm4a', 'audio/mpeg': 'mp3' };
export const audioName = ext => 'audio.' + ext;
export const shotName = n => `shot-${n}.jpg`;
const B64 = /^[A-Za-z0-9+/]*={0,2}$/;
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

// an id by the relay's own UTC clock: sortable, never a client's
export function newId(now = Date.now()) {
  const d = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '').replace('T', '-');
  const a = 'abcdefghijklmnopqrstuvwxyz0123456789', r = crypto.randomBytes(4);
  return d + '-' + [...r].map(b => a[b % 36]).join('');
}

// the body of POST /api/notes as parsed JSON: { error } in words, or { note, audio: { buf, ext } | null, shots: [{ n, buf }] }
export function parseNote(b, got = Date.now()) {
  if (!isObj(b)) return { error: 'the body is a JSON object (see tools/notes/SPEC.md)' };
  if (b.v !== 1) return { error: 'v: 1 is the only version' };
  if (typeof b.at !== 'number' || !isFinite(b.at)) return { error: 'at: the device\'s clock in ms (a number)' };
  if (typeof b.dur !== 'number' || !isFinite(b.dur) || b.dur < 0 || b.dur > 3600) return { error: 'dur: seconds, 0 to 3600' };
  if (b.kind !== 'headset' && b.kind !== 'page') return { error: 'kind: "headset" or "page"' };
  if (b.name !== undefined && b.name !== null && (typeof b.name !== 'string' || b.name.length > 80)) return { error: 'name: a string of at most 80 characters' };
  let audio = null, meta = null;
  if (b.audio !== undefined && b.audio !== null) {
    if (!isObj(b.audio) || typeof b.audio.type !== 'string' || typeof b.audio.data !== 'string') return { error: 'audio: null or { type, data (base64) }' };
    const base = b.audio.type.split(';')[0].trim().toLowerCase(), ext = AUDIO_EXT[base];
    if (!ext) return { error: 'audio.type: audio/webm, audio/ogg, audio/mp4 or audio/mpeg' };
    if (!B64.test(b.audio.data) || b.audio.data.length % 4) return { error: 'audio.data is not base64' };
    const buf = Buffer.from(b.audio.data, 'base64');
    if (!buf.length) return { error: 'audio.data is empty (send audio: null for a note without a recording)' };
    audio = { buf, ext };
    meta = { type: b.audio.type.slice(0, 80), size: buf.length, file: audioName(ext) };
    // how late the microphone began after the recording did (s): a pin's t less this is its place in the audio
    if (typeof b.audio.off === 'number' && isFinite(b.audio.off) && b.audio.off >= -10 && b.audio.off <= 60) meta.off = Math.round(b.audio.off * 1000) / 1000;
  }
  if (b.shots !== undefined && !Array.isArray(b.shots)) return { error: 'shots: a list' };
  const shots = [], shotMeta = [];
  for (const [i, s] of (b.shots || []).entries()) {
    if (i >= 2) return { error: 'shots: at most 2' };
    if (!isObj(s) || (s.at !== 'start' && s.at !== 'end')) return { error: `shots[${i}].at: "start" or "end"` };
    if (s.data === undefined) {
      if (typeof s.err !== 'string') return { error: `shots[${i}]: a picture (type, w, h, data) or an err` };
      shotMeta.push({ at: s.at, err: s.err.slice(0, 200) });
      continue;
    }
    if (typeof s.data !== 'string' || !B64.test(s.data) || s.data.length % 4 || !s.data.length) return { error: `shots[${i}].data is not base64` };
    if (s.type !== 'image/jpeg') return { error: `shots[${i}].type: image/jpeg` };
    const buf = Buffer.from(s.data, 'base64');
    shots.push({ n: i + 1, buf });
    const num = v => (typeof v === 'number' && isFinite(v) ? Math.round(v) : 0);
    shotMeta.push({ at: s.at, type: 'image/jpeg', w: num(s.w), h: num(s.h), size: buf.length, file: shotName(i + 1) });
  }
  if (b.pins !== undefined && (!Array.isArray(b.pins) || b.pins.length > 500)) return { error: 'pins: a list of at most 500' };
  if (b.context !== undefined && !isObj(b.context)) return { error: 'context: an object' };
  const context = b.context || {}, pins = b.pins || [];
  if (JSON.stringify(context).length > MAX_CONTEXT) return { error: 'context is too big (at most 1 MB)' };
  const note = { v: 1, id: '', at: b.at, got, dur: Math.round(b.dur * 100) / 100, kind: b.kind, name: typeof b.name === 'string' ? b.name : '',
    audio: meta, shots: shotMeta, pins, context, size: 0, status: 'new', transcript: null };
  if (typeof b.audioErr === 'string' && b.audioErr) note.audioErr = b.audioErr.slice(0, 200);   // (why there is no audio)
  if (typeof b.nonce === 'string' && NONCE.test(b.nonce)) note.nonce = b.nonce;   // (the client's, so a note sent twice is kept once)
  return { note, audio, shots };
}

// the listing's row for a note (its note.json as kept)
export function summary(n) {
  const c = isObj(n.context) ? n.context : {}, st = c.room && c.room.station;
  return { id: n.id, at: n.at, got: n.got, dur: n.dur, kind: n.kind, name: n.name || '', status: n.status,
    story: typeof c.story === 'string' ? c.story : '', station: st ? String(st.title || st.id || '') : '', release: typeof c.release === 'string' ? c.release : '',
    device: typeof c.device === 'string' ? c.device : '', pins: Array.isArray(n.pins) ? n.pins.length : 0, shots: (n.shots || []).filter(s => s.size).length,
    audio: !!n.audio, nonce: typeof n.nonce === 'string' ? n.nonce : '', transcript: n.transcript && typeof n.transcript.text === 'string' ? n.transcript.text.slice(0, 200) : null };
}
const newest = (a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

// a transcript or status update: { error } or { patch }
export function parseUpdate(b, at = Date.now()) {
  if (!isObj(b)) return { error: 'the body is { status?, transcript? }' };
  const patch = {};
  if (b.status !== undefined) {
    if (b.status !== 'new' && b.status !== 'done') return { error: 'status: "new" or "done"' };
    patch.status = b.status;
  }
  if (b.transcript !== undefined) {
    const t = b.transcript;
    if (t === null) patch.transcript = null;
    else {
      if (!isObj(t) || typeof t.text !== 'string') return { error: 'transcript: null or { text, lang, segments, by }' };
      if (t.lang !== undefined && typeof t.lang !== 'string') return { error: 'transcript.lang: a string' };
      if (t.by !== undefined && typeof t.by !== 'string') return { error: 'transcript.by: a string' };
      const segs = t.segments === undefined ? [] : t.segments;
      if (!Array.isArray(segs) || segs.some(s => !isObj(s) || typeof s.text !== 'string' || typeof s.start !== 'number' || typeof s.end !== 'number')) return { error: 'transcript.segments: a list of { start, end, text }' };
      const tr = { text: t.text, lang: String(t.lang || '').slice(0, 16), segments: segs.map(s => ({ start: s.start, end: s.end, text: s.text })), by: String(t.by || '').slice(0, 60), at };
      if (JSON.stringify(tr).length > MAX_TRANSCRIPT) return { error: 'the transcript is too big (at most 200 KB)' };
      patch.transcript = tr;
    }
  }
  if (!Object.keys(patch).length) return { error: 'nothing to change: status and/or transcript' };
  return { patch };
}

// ---- the folder's store. Each method answers like the R2 one: no throwing for a missing note (null / false)
export function folderStore(root) {
  const dirOf = id => path.join(root, id);
  const cache = new Map(), chain = new Map();   // summaries by id (kept while note.json's size and time stand); writes to one note in turn
  const ids = async () => {
    let ents = [];
    try { ents = await fs.promises.readdir(root, { withFileTypes: true }); } catch { return []; }
    return ents.filter(e => e.isDirectory() && NOTE_ID.test(e.name)).map(e => e.name);
  };
  const readNote = async id => {
    try { return JSON.parse(await fs.promises.readFile(path.join(dirOf(id), NOTE), 'utf8')); } catch { return null; }
  };
  const serial = (id, fn) => {
    const run = (chain.get(id) || Promise.resolve()).catch(() => {}).then(fn);
    chain.set(id, run);
    return run.finally(() => { if (chain.get(id) === run) chain.delete(id); });
  };
  return {
    where: root,
    async count() { return (await ids()).length; },
    async list() {
      const out = [];
      for (const id of await ids()) {
        let st;
        try { st = await fs.promises.stat(path.join(dirOf(id), NOTE)); } catch { continue; }
        const sig = st.size + ':' + st.mtimeMs, c = cache.get(id);
        if (c && c.sig === sig) { out.push(c.s); continue; }
        const n = await readNote(id);
        if (!n || n.id !== id) continue;
        const s = summary(n);
        cache.set(id, { sig, s });
        out.push(s);
      }
      return out.sort(newest);
    },
    // a new note: files into a hidden folder of its own, moved into place whole (never half a note in the listing)
    async put(id, note, audio, shots) {
      await fs.promises.mkdir(root, { recursive: true });
      const tmp = path.join(root, '.tmp-' + crypto.randomBytes(6).toString('hex'));
      await fs.promises.mkdir(tmp);
      try {
        if (audio) await fs.promises.writeFile(path.join(tmp, audioName(audio.ext)), audio.buf);
        for (const s of shots) await fs.promises.writeFile(path.join(tmp, shotName(s.n)), s.buf);
        await fs.promises.writeFile(path.join(tmp, NOTE), JSON.stringify(note));
        await fs.promises.rename(tmp, dirOf(id));
      } catch (err) { await fs.promises.rm(tmp, { recursive: true, force: true }); throw err; }
    },
    exists: async id => !!(await readNote(id)),
    get: readNote,
    // a file of a note as bytes: { buf } or null
    async file(id, name) {
      try { return { buf: await fs.promises.readFile(path.join(dirOf(id), name)) }; } catch { return null; }
    },
    update: (id, patch) => serial(id, async () => {
      const n = await readNote(id);
      if (!n) return null;
      Object.assign(n, patch);
      const f = path.join(dirOf(id), NOTE), tmp = f + '.tmp-' + crypto.randomBytes(4).toString('hex');
      await fs.promises.writeFile(tmp, JSON.stringify(n));
      await fs.promises.rename(tmp, f);
      return n;
    }),
    del: id => serial(id, async () => {
      if (!(await fs.promises.stat(dirOf(id)).catch(() => null))) return false;
      await fs.promises.rm(dirOf(id), { recursive: true, force: true });
      cache.delete(id);
      return true;
    }),
  };
}

// ---- the R2 store: RX an r2.mjs R2, prefix the key prefix with the trailing slash (R2_PREFIX + '.notes/')
export function r2Store(RX, prefix) {
  const key = (id, rel) => `${prefix}${id}/${rel}`;
  const cache = new Map(), chain = new Map();   // summaries by id and note.json's etag
  const listing = async () => {
    const r = await RX.listAll(prefix, { limit: 50000 });
    const by = new Map();
    for (const o of r.keys) {
      const rest = o.key.slice(prefix.length), i = rest.indexOf('/');
      if (i < 0 || !NOTE_ID.test(rest.slice(0, i))) continue;
      const id = rest.slice(0, i);
      if (!by.has(id)) by.set(id, { id, etag: '', keys: [] });
      const e = by.get(id);
      e.keys.push(o.key);
      if (rest.slice(i + 1) === NOTE) e.etag = o.etag + ':' + o.size;
    }
    return [...by.values()].filter(e => e.etag);
  };
  const readNote = async id => {
    const b = await RX.get(key(id, NOTE));
    if (!b) return null;
    try { return JSON.parse(String(b)); } catch { return null; }
  };
  const serial = (id, fn) => {
    const run = (chain.get(id) || Promise.resolve()).catch(() => {}).then(fn);
    chain.set(id, run);
    return run.finally(() => { if (chain.get(id) === run) chain.delete(id); });
  };
  return {
    where: 'r2:' + prefix,
    async count() { return (await listing()).length; },
    async list() {
      const out = [];
      for (const e of await listing()) {
        const c = cache.get(e.id);
        if (c && c.etag === e.etag) { out.push(c.s); continue; }
        const n = await readNote(e.id);
        if (!n || n.id !== e.id) continue;
        const s = summary(n);
        cache.set(e.id, { etag: e.etag, s });
        out.push(s);
      }
      return out.sort(newest);
    },
    // (the note.json last: a note is listed only once it is whole)
    async put(id, note, audio, shots) {
      if (audio) await RX.put(key(id, audioName(audio.ext)), audio.buf, { type: note.audio.type.split(';')[0] });
      for (const s of shots) await RX.put(key(id, shotName(s.n)), s.buf, { type: 'image/jpeg' });
      await RX.put(key(id, NOTE), Buffer.from(JSON.stringify(note)), { type: 'application/json' });
    },
    exists: async id => !!(await RX.stat(key(id, NOTE))),
    get: readNote,
    async file(id, name) { const b = await RX.get(key(id, name)); return b ? { buf: b } : null; },
    update: (id, patch) => serial(id, async () => {
      const n = await readNote(id);
      if (!n) return null;
      Object.assign(n, patch);
      await RX.put(key(id, NOTE), Buffer.from(JSON.stringify(n)), { type: 'application/json' });
      return n;
    }),
    del: id => serial(id, async () => {
      const r = await RX.listAll(key(id, ''));
      if (!r.keys.length) return false;
      await RX.delMany(r.keys.map(o => o.key));
      cache.delete(id);
      return true;
    }),
  };
}

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
    const r = await RX.listAll(prefix, { limit: 50000, skip: prefix + LOGS_DIR + '/' });   // (the run logs' keys stepped over)
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


// ---- run logs (tools/notes/SPEC.md, "Run logs"; the owner, 22 November 2026: "push logs right into the relay when needed,
// grab them from there same as the developer notes"). A run is one device's frame times, a row a second, sent in parts every
// 30 s: <id>/log.json (what the run is: its context, its columns, a part's counts) and <id>/part-<seq>.json (a list of rows).
// Kept beside the notes, in their .logs/ (a folder) or under <prefix>.logs/ (R2); the notes' listing never sees them.
export const LOGS_DIR = '.logs', LOG = 'log.json';
export const MAX_LOGS = 500, MAX_LOG_START = 128 << 10, MAX_PART = 512 << 10, MAX_LOG_BYTES = 8 << 20, MAX_PARTS = 1000, MAX_ROWS = 5000;
export const partName = seq => `part-${String(seq).padStart(5, '0')}.json`;
const prim = v => v === null || typeof v === 'boolean' || (typeof v === 'number' && isFinite(v)) || (typeof v === 'string' && v.length <= 200);

// the body of POST /api/logs (a run begins): { error } or { log }
export function parseLogStart(b, got = Date.now()) {
  if (!isObj(b)) return { error: 'the body is a JSON object (see tools/notes/SPEC.md, "Run logs")' };
  if (b.v !== 1) return { error: 'v: 1 is the only version' };
  if (typeof b.at !== 'number' || !isFinite(b.at)) return { error: 'at: the device\'s clock in ms (a number)' };
  if (!Array.isArray(b.cols) || !b.cols.length || b.cols.length > 40 || b.cols.some(c => typeof c !== 'string' || !c || c.length > 40)) return { error: 'cols: a list of at most 40 column names' };
  if (b.context !== undefined && !isObj(b.context)) return { error: 'context: an object' };
  const log = { v: 1, id: '', kind: 'log', at: b.at, got, upd: got, cols: b.cols.slice(), context: b.context || {}, parts: [], rows: 0, events: 0, size: 0, first: 0, last: 0, stories: [], storyAt: {}, ended: false };
  if (typeof b.nonce === 'string' && NONCE.test(b.nonce)) log.nonce = b.nonce;
  return { log };
}
// the body of POST /api/logs/<id> (a part): { error } or { seq, rows, end }
export function parseLogPart(b) {
  if (!isObj(b)) return { error: 'the body is { seq, rows, end? }' };
  if (!Number.isInteger(b.seq) || b.seq < 0 || b.seq >= MAX_PARTS) return { error: `seq: a whole number from 0 to ${MAX_PARTS - 1}` };
  if (!Array.isArray(b.rows) || b.rows.length > MAX_ROWS) return { error: `rows: a list of at most ${MAX_ROWS}` };
  for (const [i, r] of b.rows.entries()) {
    const okRow = Array.isArray(r) ? r.length <= 40 && r.every(prim) && typeof r[0] === 'number'
      : isObj(r) && typeof r.ev === 'string' && r.ev.length <= 40 && typeof r.w === 'number' && Object.keys(r).length <= 24 && Object.values(r).every(prim);
    if (!okRow) return { error: `rows[${i}]: a row (a list of numbers, strings, true, false or null, the wall time first) or an event ({ w, ev, ... })` };
  }
  return { seq: b.seq, rows: b.rows, end: b.end === true };
}
// the listing's row for a run (its log.json as kept)
export function logSummary(g) {
  const c = isObj(g.context) ? g.context : {};
  return { id: g.id, kind: 'log', at: g.at, got: g.got, upd: g.upd, dur: g.first && g.last > g.first ? Math.round((g.last - g.first) / 100) / 10 : 0,
    rows: g.rows, events: g.events, parts: (g.parts || []).length, size: g.size, ended: !!g.ended, stories: g.stories || [], story: (g.stories || [])[0] || '',
    device: typeof c.device === 'string' ? c.device : '', release: typeof c.release === 'string' ? c.release : '', xr: typeof c.xr === 'string' ? c.xr : '', nonce: typeof g.nonce === 'string' ? g.nonce : '' };
}
// a part's counts folded into the run's log.json (the part was written already)
function foldPart(g, seq, rows, bytes, end, now) {
  const si = g.cols.indexOf('story');
  if (!isObj(g.storyAt)) g.storyAt = {};
  g.parts = (g.parts || []).filter(p => p[0] !== seq);
  let n = 0, ev = 0;
  for (const r of rows) {
    const w = Array.isArray(r) ? r[0] : r.w;
    if (Array.isArray(r)) n++; else ev++;
    if (w > 0) { if (!g.first || w < g.first) g.first = w; if (w > g.last) g.last = w; }
    const k = Array.isArray(r) ? (si >= 0 ? r[si] : '') : r.ev === 'story' ? r.story : '';
    // (the stories in the order they came, whatever order the parts arrive in: each by the first time it was seen)
    if (typeof k === 'string' && k && w > 0 && (k in g.storyAt ? g.storyAt[k] > w : Object.keys(g.storyAt).length < 40)) g.storyAt[k] = w;
  }
  g.stories = Object.keys(g.storyAt).sort((a, b) => g.storyAt[a] - g.storyAt[b]);
  g.parts.push([seq, n, ev, bytes]);
  g.parts.sort((a, b) => a[0] - b[0]);
  g.rows = g.parts.reduce((s, p) => s + p[1], 0); g.events = g.parts.reduce((s, p) => s + p[2], 0); g.size = g.parts.reduce((s, p) => s + p[3], 0);
  if (end) g.ended = true;
  g.upd = now;
  return g;
}
// the store over a backend { put(id, name, buf), get(id, name), ids(), sig(id), del(id) } (a folder or R2)
function logStore(be, where) {
  const cache = new Map(), chain = new Map();
  const serial = (id, fn) => {
    const run = (chain.get(id) || Promise.resolve()).catch(() => {}).then(fn);
    chain.set(id, run);
    return run.finally(() => { if (chain.get(id) === run) chain.delete(id); });
  };
  const readLog = async id => { const b = await be.get(id, LOG); if (!b) return null; try { return JSON.parse(String(b)); } catch { return null; } };
  return {
    where,
    async count() { return (await be.ids()).length; },
    async list() {
      const out = [];
      for (const [id, sig] of await be.sigs()) {
        const c = cache.get(id);
        if (c && c.sig === sig) { out.push(c.s); continue; }
        const g = await readLog(id);
        if (!g || g.id !== id) continue;
        const s = logSummary(g);
        cache.set(id, { sig, s });
        out.push(s);
      }
      return out.sort(newest);
    },
    put: (id, g) => be.put(id, LOG, Buffer.from(JSON.stringify(g))),
    get: readLog,
    exists: async id => !!(await readLog(id)),
    // a part: written under its seq (sent again, it replaces itself), then the run's counts; { error, status } past the limits
    append: (id, seq, rows, end, now = Date.now()) => serial(id, async () => {
      const g = await readLog(id);
      if (!g) return null;
      const buf = Buffer.from(JSON.stringify(rows)), was = (g.parts || []).find(p => p[0] === seq);
      if (g.size - (was ? was[3] : 0) + buf.length > MAX_LOG_BYTES) return { error: `a run is at most ${MAX_LOG_BYTES >> 20} MB: start another`, status: 413 };
      await be.put(id, partName(seq), buf);
      foldPart(g, seq, rows, buf.length, end, now);
      await be.put(id, LOG, Buffer.from(JSON.stringify(g)));
      return { log: g };
    }),
    // the whole run: its log.json with every part's rows in order (a part that cannot be read is named in missing)
    async full(id) {
      const g = await readLog(id);
      if (!g) return null;
      const rows = [], missing = [];
      for (const [seq] of g.parts || []) {
        const b = await be.get(id, partName(seq));
        let r = null; try { r = b ? JSON.parse(String(b)) : null; } catch { r = null; }
        if (Array.isArray(r)) rows.push(...r); else missing.push(seq);
      }
      return Object.assign(g, { rows }, missing.length ? { missing } : {});
    },
    del: id => serial(id, async () => { const ok = await be.del(id); cache.delete(id); return ok; }),
  };
}
export function logFolderStore(root) {
  const dirOf = id => path.join(root, id);
  const ids = async () => {
    let ents = [];
    try { ents = await fs.promises.readdir(root, { withFileTypes: true }); } catch { return []; }
    return ents.filter(e => e.isDirectory() && NOTE_ID.test(e.name)).map(e => e.name);
  };
  return logStore({
    ids,
    async sigs() {
      const out = [];
      for (const id of await ids()) { try { const st = await fs.promises.stat(path.join(dirOf(id), LOG)); out.push([id, st.size + ':' + st.mtimeMs]); } catch { /* not whole */ } }
      return out;
    },
    async put(id, name, buf) {
      await fs.promises.mkdir(dirOf(id), { recursive: true });
      const f = path.join(dirOf(id), name), tmp = f + '.tmp-' + crypto.randomBytes(4).toString('hex');
      await fs.promises.writeFile(tmp, buf);
      await fs.promises.rename(tmp, f);
    },
    async get(id, name) { try { return await fs.promises.readFile(path.join(dirOf(id), name)); } catch { return null; } },
    async del(id) {
      if (!(await fs.promises.stat(dirOf(id)).catch(() => null))) return false;
      await fs.promises.rm(dirOf(id), { recursive: true, force: true });
      return true;
    },
  }, root);
}
export function logR2Store(RX, prefix) {
  const key = (id, rel) => `${prefix}${id}/${rel}`;
  const sigs = async () => {
    const r = await RX.listAll(prefix, { limit: 50000 }), out = [];
    for (const o of r.keys) {
      const rest = o.key.slice(prefix.length), i = rest.indexOf('/');
      if (i > 0 && NOTE_ID.test(rest.slice(0, i)) && rest.slice(i + 1) === LOG) out.push([rest.slice(0, i), o.etag + ':' + o.size]);
    }
    return out;
  };
  return logStore({
    sigs,
    ids: async () => (await sigs()).map(e => e[0]),
    put: (id, name, buf) => RX.put(key(id, name), buf, { type: 'application/json' }),
    get: (id, name) => RX.get(key(id, name)),
    async del(id) {
      const r = await RX.listAll(key(id, ''));
      if (!r.keys.length) return false;
      await RX.delMany(r.keys.map(o => o.key));
      return true;
    },
  }, 'r2:' + prefix);
}

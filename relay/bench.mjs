// The headset bench's store (tools/bench/SPEC.md, sections 4 and 5): jobs the cloud posts for a headset in bench mode, and
// what the headset sends back (its result, its pictures; the adb helper's frame statistics and device screenshots). Kept
// beside the notes in a folder or an R2 bucket, by the notes' rules: <id>/job.json, <id>/pic-<n>.jpg, <id>/devshot-<n>.<ext>;
// in memory only when the relay keeps no notes (a relay for a test). Node's own modules only. This file never logs: the
// callers log only the lines tools/bench/SPEC.md 4.4 allows (never a step's fields, a result, a report or a password).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { NOTE_ID } from './notes.mjs';

export const BENCH_DIR = '.bench', JOB = 'job.json';
export const HS = /^[a-z0-9]{8}$/;
export const MAX_JOB = 64 << 10, MAX_JOBS = 1000, MAX_QUEUED = 50, MAX_STEPS = 200, MAX_HELLO = 32 << 10, MAX_PROGRESS = 4 << 10,
  MAX_RESULT = 1 << 20, MAX_PIC = 1 << 20, MAX_PICS = 20, MAX_ADB = 512 << 10, MAX_DEVSHOT = 4 << 20, MAX_DEVSHOTS = 5;
// ended jobs are kept KEEP_ENDED ms, and the oldest ended go first while the jobs' bytes pass MAX_BYTES or a new job needs a
// place; the headsets and helpers the relay remembers (in memory only), and the long polls held at once
export const KEEP_ENDED = 14 * 24 * 3600 * 1000, MAX_BYTES = 1 << 30, MAX_HEADS = 32, MAX_POLLS = 16;
export const STATES = ['queued', 'running', 'done', 'failed', 'cancelled', 'expired'];
export const ENDED = new Set(['done', 'failed', 'cancelled', 'expired']);
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const KEYRE = /^[a-z][a-z0-9-]{0,31}$/, NAMERE = /^[\w .-]{1,80}$/;

// the commands a page runs (SPEC 5.2) and the adb helper's (9.4), each with the fields it takes besides cmd, label, soft
const PAGE_CMDS = {
  report: [], open: ['story', 'scene', 'src'], seek: ['chapter', 't', 'play'], play: [], pause: [], explore: ['tab'], set: ['name', 'value'],
  measure: ['sec', 'name'], rays: ['hand', 'preset', 'path', 'sec', 'press', 'measure'], pic: ['w', 'q'], probe: ['name', 'args'], wait: ['sec', 'until'], reload: [],
  script: ['code', 'args', 'limit'],   // (SPEC 14: only on a relay with --bench-scripts, which server.mjs checks before this)
};
const ADB_CMDS = { devshot: ['n'], enter: [], open: [], vrapi: ['from', 'to', 'job'] };
const JOB_FIELDS = new Set(['v', 'label', 'to', 'need', 'hs', 'with', 'sound', 'limit', 'ttl', 'adb', 'from', 'why', 'steps', 'view']);
const num = (v, a, b) => typeof v === 'number' && isFinite(v) && v >= a && v <= b;
const prim = v => v === null || typeof v === 'boolean' || (typeof v === 'number' && isFinite(v)) || (typeof v === 'string' && v.length <= 80);

// one step's fields: an error in words naming the field, or ''
function stepError(s, i, to) {
  const at = `steps[${i}]`;
  if (!isObj(s)) return `${at}: an object { cmd, ... }`;
  const C = to === 'adb' ? ADB_CMDS : PAGE_CMDS;
  if (typeof s.cmd !== 'string' || !C[s.cmd]) return `${at}.cmd: one of ${Object.keys(C).join(', ')}`;
  for (const k of Object.keys(s)) if (k !== 'cmd' && k !== 'label' && k !== 'soft' && !C[s.cmd].includes(k)) return `${at}.${k}: not a field of ${s.cmd}`;
  if (s.label !== undefined && (typeof s.label !== 'string' || s.label.length > 80)) return `${at}.label: a string of at most 80 characters`;
  if (s.soft !== undefined && typeof s.soft !== 'boolean') return `${at}.soft: true or false`;
  const has = k => s[k] !== undefined;
  switch (s.cmd) {
    case 'open':
      if (to === 'adb') break;
      if (has('story') === has('scene')) return `${at}: a story or a scene`;
      if (has('story') && (typeof s.story !== 'string' || !KEYRE.test(s.story))) return `${at}.story: a story's key`;
      if (has('scene') && (typeof s.scene !== 'string' || !NAMERE.test(s.scene))) return `${at}.scene: a scene's name`;
      if (has('src') && s.src !== 'examples' && s.src !== 'relay') return `${at}.src: examples or relay`;
      break;
    case 'seek':
      if (has('chapter') === has('t')) return `${at}: a chapter or a time t`;
      if (has('chapter') && !(Number.isInteger(s.chapter) && s.chapter >= 0 && s.chapter < 200)) return `${at}.chapter: an index from 0`;
      if (has('t') && !num(s.t, 0, 36000)) return `${at}.t: story seconds`;
      if (has('play') && typeof s.play !== 'boolean') return `${at}.play: true or false`;
      break;
    case 'explore':
      if (has('tab') && !(Number.isInteger(s.tab) && s.tab >= 0 && s.tab < 50) && !(typeof s.tab === 'string' && /^[\w-]{1,30}$/.test(s.tab))) return `${at}.tab: an index or a tab's id`;
      break;
    case 'set':
      if (typeof s.name !== 'string' || !/^[a-zA-Z]{1,20}$/.test(s.name)) return `${at}.name: a setting's name`;
      if (!prim(s.value) || s.value === null) return `${at}.value: a number, a string or true or false`;
      break;
    case 'measure':
      if (!num(s.sec, 1, 600)) return `${at}.sec: 1 to 600`;
      if (has('name') && (typeof s.name !== 'string' || s.name.length > 40)) return `${at}.name: at most 40 characters`;
      break;
    case 'rays':
      if (has('hand') && s.hand !== 0 && s.hand !== 1) return `${at}.hand: 0 or 1`;
      if (has('preset') && !['sweep', 'circle', 'still'].includes(s.preset)) return `${at}.preset: sweep, circle or still`;
      if (has('preset') && has('path')) return `${at}: a preset or a path`;
      if (has('path')) {
        if (!Array.isArray(s.path) || !s.path.length || s.path.length > 600) return `${at}.path: 1 to 600 points`;
        for (const [j, p] of s.path.entries()) {
          const v3 = a => Array.isArray(a) && a.length === 3 && a.every(x => num(x, -100, 100)), v4 = a => Array.isArray(a) && a.length === 4 && a.every(x => num(x, -1.01, 1.01));
          if (!isObj(p) || !num(p.at, 0, 600) || !v3(p.p) || (p.q === undefined) === (p.look === undefined) || (p.q !== undefined && !v4(p.q)) || (p.look !== undefined && !v3(p.look))) return `${at}.path[${j}]: { at, p: [x, y, z], q: [x, y, z, w] or look: [x, y, z] }`;
        }
      }
      if (has('sec') && !num(s.sec, 0.5, 600)) return `${at}.sec: 0.5 to 600`;
      if (has('press')) {
        if (!Array.isArray(s.press) || s.press.length > 100) return `${at}.press: at most 100`;
        for (const [j, p] of s.press.entries()) if (!isObj(p) || !num(p.at, 0, 600) || typeof p.down !== 'boolean') return `${at}.press[${j}]: { at, down }`;
      }
      if (has('measure') && typeof s.measure !== 'boolean') return `${at}.measure: true or false`;
      break;
    case 'pic':
      if (has('w') && !num(s.w, 320, 1280)) return `${at}.w: 320 to 1280`;
      if (has('q') && !num(s.q, 0.5, 0.92)) return `${at}.q: 0.5 to 0.92`;
      break;
    case 'probe':
      if (typeof s.name !== 'string' || !KEYRE.test(s.name)) return `${at}.name: a probe's name (a-z, 0-9, -)`;
      if (has('args') && JSON.stringify(s.args).length > 8192) return `${at}.args: at most 8 KB`;
      break;
    case 'script':
      if (typeof s.code !== 'string' || !s.code.trim()) return `${at}.code: the body of an async function (api, args), as text`;
      if (has('args') && JSON.stringify(s.args).length > 8192) return `${at}.args: at most 8 KB`;
      if (has('limit') && !num(s.limit, 1, 3600)) return `${at}.limit: 1 to 3600 seconds`;
      break;
    case 'wait':
      if (has('sec') === has('until')) return `${at}: sec or until`;
      if (has('sec') && !num(s.sec, 0, 600)) return `${at}.sec: 0 to 600`;
      if (has('until') && s.until !== 'quiet') return `${at}.until: quiet`;
      break;
    case 'devshot':
      if (has('n') && !(Number.isInteger(s.n) && s.n >= 1 && s.n <= MAX_DEVSHOTS)) return `${at}.n: 1 to ${MAX_DEVSHOTS}`;
      break;
    case 'vrapi':
      if (!num(s.from, 0, 1e14) || !num(s.to, 0, 1e14) || s.to < s.from) return `${at}: from and to (ms)`;
      if (has('job') && (typeof s.job !== 'string' || !NOTE_ID.test(s.job))) return `${at}.job: a job's id (the statistics go onto that job)`;
      break;
  }
  return '';
}

// the body of POST /api/bench/jobs: { error } naming the first bad field, or { job } (the posted fields, defaults filled)
export function parseJob(b) {
  if (!isObj(b)) return { error: 'the body is a JSON object (tools/bench/SPEC.md, 5.1)' };
  for (const k of Object.keys(b)) if (!JOB_FIELDS.has(k)) return { error: `${k}: not a field of a job` + (k === 'page' ? ' (a plan\'s page part is posted as a job of its own: tools/bench/bench.mjs run)' : '') };
  if (b.v !== undefined && b.v !== 1) return { error: 'v: 1 is the only version' };
  if (b.label !== undefined && (typeof b.label !== 'string' || b.label.length > 80)) return { error: 'label: a string of at most 80 characters' };
  const to = b.to === undefined ? 'page' : b.to;
  if (to !== 'page' && to !== 'adb') return { error: 'to: page or adb' };
  if (b.need !== undefined && !['xr', 'ar', 'vr', 'page', 'any'].includes(b.need)) return { error: 'need: xr, ar, vr, page or any' };
  if (b.hs !== undefined && b.hs !== '' && (typeof b.hs !== 'string' || !HS.test(b.hs))) return { error: 'hs: a headset\'s id (eight letters and digits) or empty' };
  if (b.with !== undefined) {
    if (!isObj(b.with) || Object.keys(b.with).length > 20) return { error: 'with: an object of at most 20 settings' };
    for (const [k, v] of Object.entries(b.with)) if (!/^[a-zA-Z]{1,20}$/.test(k) || !prim(v) || v === null) return { error: `with.${k.slice(0, 20)}: a setting's name and a number, string or true or false` };
  }
  if (b.sound !== undefined && typeof b.sound !== 'boolean') return { error: 'sound: true or false' };
  if (b.view !== undefined && b.view !== 'fixed' && b.view !== 'asis') return { error: 'view: fixed or asis' };   // (v233, SPEC 15)
  if (b.limit !== undefined && !num(b.limit, 1, 3600)) return { error: 'limit: 1 to 3600 seconds' };
  if (b.ttl !== undefined && !num(b.ttl, 1, 86400)) return { error: 'ttl: 1 to 86400 seconds' };
  if (b.adb !== undefined && typeof b.adb !== 'boolean') return { error: 'adb: true or false' };
  if (b.from !== undefined && b.from !== 'cloud' && b.from !== 'auto') return { error: 'from: cloud or auto' };
  if (b.why !== undefined && (typeof b.why !== 'string' || b.why.length > 120)) return { error: 'why: a string of at most 120 characters' };
  if (!Array.isArray(b.steps) || !b.steps.length || b.steps.length > MAX_STEPS) return { error: `steps: a list of 1 to ${MAX_STEPS} steps` };
  for (const [i, s] of b.steps.entries()) { const e = stepError(s, i, to); if (e) return { error: e }; }
  if (b.from === 'auto' && b.steps.some(s => s.cmd === 'script')) return { error: 'steps: an automatic plan never holds a script step' };
  const light = b.steps.every(s => s.cmd === 'report' || s.cmd === 'wait');
  const job = {
    v: 1, label: b.label || b.steps.map(s => s.cmd).slice(0, 4).join(', '), to, need: b.need || (to === 'adb' || light ? 'any' : 'xr'), hs: b.hs || '',
    with: b.with || {}, sound: !!b.sound, limit: b.limit || 300, ttl: b.ttl || 900, adb: b.adb !== false, from: b.from || 'cloud', why: b.why || '', view: b.view || 'fixed', steps: b.steps,
  };
  return { job };
}

// a headset's hello: { hs, report } (the report any JSON object, its size checked by the caller)
export function parseHello(b) {
  if (!isObj(b) || typeof b.hs !== 'string' || !HS.test(b.hs)) return { error: 'hs: the headset\'s id (eight letters and digits)' };
  if (b.report !== undefined && !isObj(b.report)) return { error: 'report: an object' };
  return { hs: b.hs, report: b.report || {} };
}
export function parseProgress(b) {
  if (!isObj(b) || typeof b.hs !== 'string' || !(HS.test(b.hs) || b.hs === 'adb')) return { error: 'hs: the headset\'s id' };
  return { hs: b.hs, step: Number.isInteger(b.step) ? b.step : -1, of: Number.isInteger(b.of) ? b.of : 0, note: typeof b.note === 'string' ? b.note.slice(0, 200) : '' };
}
export function parseResult(b) {
  if (!isObj(b) || typeof b.hs !== 'string' || !(HS.test(b.hs) || b.hs === 'adb')) return { error: 'hs: the headset\'s id' };
  if (typeof b.ok !== 'boolean') return { error: 'ok: true or false' };
  if (b.why !== undefined && typeof b.why !== 'string') return { error: 'why: a string' };
  if (b.steps !== undefined && (!Array.isArray(b.steps) || b.steps.length > MAX_STEPS + 1)) return { error: 'steps: a list' };
  if (b.report !== undefined && b.report !== null && !isObj(b.report)) return { error: 'report: an object' };
  if (b.view !== undefined && b.view !== null && !isObj(b.view)) return { error: 'view: an object' };
  return { result: { hs: b.hs, ok: b.ok, why: String(b.why || '').slice(0, 300), t0: num(b.t0, 0, 1e14) ? b.t0 : 0, t1: num(b.t1, 0, 1e14) ? b.t1 : 0, steps: b.steps || [], report: b.report || null, view: b.view || null } };
}
export function parseAdb(b) {
  if (!isObj(b)) return { error: 'the body is { vrapi, notes }' };
  if (b.vrapi !== null && b.vrapi !== undefined && !isObj(b.vrapi)) return { error: 'vrapi: an object or null' };
  return { adb: { vrapi: b.vrapi || null, notes: typeof b.notes === 'string' ? b.notes.slice(0, 2000) : '', at: Date.now() } };
}

// a script step's code as the listing and the tool name it: its length and a short hash (sha256, 12 hex), never the text
export const codeTag = code => ({ bytes: Buffer.byteLength(String(code)), sha: crypto.createHash('sha256').update(String(code)).digest('hex').slice(0, 12) });
// a job's row in the listing (a script step's code only as its length and hash: GET /api/bench/jobs/<id> gives the text)
export const summary = r => {
  const sc = (r.steps || []).map((s, i) => (s && s.cmd === 'script' ? { i, ...codeTag(s.code) } : null)).filter(Boolean);
  return { id: r.id, label: r.label, state: r.state, why: r.why || '', at: r.at, ended: r.ended || 0, hs: r.hs || '', steps: r.steps.length, ok: r.result ? !!r.result.ok : null, from: r.from, to: r.to, need: r.need, ...(sc.length ? { scripts: sc } : {}) };
};
// the bytes a job keeps: its pictures, device screenshots, result and helper's lines (rb and ab: their JSON's length,
// stamped as they are posted)
export const bytesOf = r => [...(r.pics || []), ...(r.devshots || [])].reduce((a, e) => a + (e.bytes || 0), 0) + (r.rb || 0) + (r.ab || 0);
// which ended jobs to delete (oldest ended first): those ended over KEEP_ENDED ago, then as many more as it takes to leave
// `room` places under MAX_JOBS and `extra` bytes under MAX_BYTES. Queued and running jobs are never chosen.
export function prune(list, now, room = 0, extra = 0, keepId = '') {
  const ended = list.filter(r => ENDED.has(r.state) && r.id !== keepId).sort((a, b) => (a.ended || a.at) - (b.ended || b.at));
  let n = list.length, bytes = list.reduce((a, r) => a + bytesOf(r), 0);
  const out = [];
  for (const r of ended) {
    if (!(now - (r.ended || r.at) > KEEP_ENDED || n + room > MAX_JOBS || bytes + extra > MAX_BYTES)) break;
    out.push(r.id); n--; bytes -= bytesOf(r);
  }
  return { ids: out, n, bytes };
}
// may this job go to this asker? (to: page with the page's session kind, or the adb helper; hs: none or the same)
export function fits(r, ask) {
  if (r.state !== 'queued') return false;
  if (r.hs && r.hs !== ask.hs) return false;
  if (ask.role === 'adb') return r.to === 'adb';
  if (r.to !== 'page') return false;
  const xr = ask.xr;
  return r.need === 'any' || r.need === 'page' || (r.need === 'xr' && (xr === 'vr' || xr === 'ar')) || r.need === xr;
}

// ---- the stores: a folder, an R2 bucket under a prefix, or memory (a relay that keeps no notes). Each keeps whole files
// under the job's id: be.ids(), be.put(id, name, buf), be.get(id, name), be.del(id)
export const picName = n => `pic-${n}.jpg`;
export const devshotName = (n, type) => `devshot-${n}.${type === 'image/png' ? 'png' : 'jpg'}`;
export function benchFolderStore(root) {
  const dirOf = id => path.join(root, id);
  return {
    where: root,
    async ids() {
      let ents = [];
      try { ents = await fs.promises.readdir(root, { withFileTypes: true }); } catch { return []; }
      return ents.filter(e => e.isDirectory() && NOTE_ID.test(e.name)).map(e => e.name);
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
  };
}
export function benchR2Store(RX, prefix) {
  const key = (id, rel) => `${prefix}${id}/${rel}`;
  return {
    where: 'r2:' + prefix,
    async ids() {
      const r = await RX.listAll(prefix, { limit: 50000 }), out = new Set();
      for (const o of r.keys) { const rest = o.key.slice(prefix.length), i = rest.indexOf('/'); if (i > 0 && NOTE_ID.test(rest.slice(0, i)) && rest.slice(i + 1) === JOB) out.add(rest.slice(0, i)); }
      return [...out];
    },
    put: (id, name, buf) => RX.put(key(id, name), buf, { type: name.endsWith('.json') ? 'application/json' : name.endsWith('.png') ? 'image/png' : 'image/jpeg' }),
    get: (id, name) => RX.get(key(id, name)),
    async del(id) {
      const r = await RX.listAll(key(id, ''));
      if (!r.keys.length) return false;
      await RX.delMany(r.keys.map(o => o.key));
      return true;
    },
  };
}
export function benchMemoryStore() {
  const M = new Map();
  return {
    where: 'memory',
    ids: async () => [...M.keys()],
    async put(id, name, buf) { if (!M.has(id)) M.set(id, new Map()); M.get(id).set(name, Buffer.from(buf)); },
    async get(id, name) { const m = M.get(id); return (m && m.get(name)) || null; },
    async del(id) { return M.delete(id); },
  };
}

// The jobs over a store: every record in memory (at most MAX_JOBS), read from the store once at first use (so a restart
// keeps them, a running job's result among them), each change written through. Writes to one job run in turn
export function benchJobs(be) {
  let all = null, loading = null;
  const chain = new Map();
  const serial = (id, fn) => {
    const run = (chain.get(id) || Promise.resolve()).catch(() => {}).then(fn);
    chain.set(id, run);
    return run.finally(() => { if (chain.get(id) === run) chain.delete(id); });
  };
  async function load() {
    if (all) return all;
    if (!loading) loading = (async () => {
      const m = new Map();
      for (const id of await be.ids()) {
        const b = await be.get(id, JOB);
        let r = null; try { r = b ? JSON.parse(String(b)) : null; } catch { r = null; }
        if (r && r.id === id && STATES.includes(r.state)) m.set(id, r);
      }
      all = m;
      return m;
    })().finally(() => { loading = null; });
    return loading;
  }
  const write = r => be.put(r.id, JOB, Buffer.from(JSON.stringify(r)));
  return {
    where: be.where, load,
    async list() { return [...(await load()).values()].sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)); },
    async get(id) { return (await load()).get(id) || null; },
    async add(r) { await load(); all.set(r.id, r); await write(r); return r; },
    // change a record: fn(r) returns false to leave it as it was; the record (changed or not), or null when there is none
    update: (id, fn) => serial(id, async () => { const r = (await load()).get(id); if (!r) return null; if (fn(r) === false) return r; await write(r); return r; }),
    putFile: (id, name, buf) => be.put(id, name, buf),
    getFile: (id, name) => be.get(id, name),
    del: id => serial(id, async () => { await load(); const had = all.delete(id); const gone = await be.del(id); return had || gone; }),
  };
}

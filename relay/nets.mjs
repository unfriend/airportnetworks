// Shared networks' store (the cell story's own networks shared through the relay: packages/ppicell/src/SPEC.md, "Stage
// 3"; relay/README.md, "Shared networks"). A network is what a page read, mapped and joined from a list of protein pairs:
// its proteins' symbols, its kinds' words, its links (two protein numbers, kind bits, a score or null) and the file's
// name; nothing else. Kept compressed under an id made from its content (the same network is the same id; nothing is
// ever overwritten by another), in a folder or in an R2 bucket by the same rules: <id>/net.json.gz, then <id>/meta.json
// (written last: a network is listed only once it is whole). Node's own modules only. This file never logs, and its
// callers log at most `net <id> <bytes>`: never a name or a protein.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

export const MAX_BODY = 12 << 20, MAX_NETS = 500, MAX_LINKS = 250000, MAX_PROT = 65535, MAX_KINDS = 7;
export const NET_ID = /^[a-z2-7]{12}$/;
export const DATA = 'net.json.gz', META = 'meta.json';
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const CTRL = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/;

// base32 (RFC 4648's letters, lower case) of the first bytes of a hash: the id, 12 letters and digits (60 bits)
function b32(buf, n) {
  const A = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = 0, v = 0, out = '';
  for (const b of buf) { v = (v << 8) | b; bits += 8; while (bits >= 5 && out.length < n) { out += A[(v >>> (bits - 5)) & 31]; bits -= 5; } if (out.length >= n) break; }
  return out;
}
export const idOf = canon => b32(crypto.createHash('sha256').update(canon).digest(), 12);

// the body of POST /api/nets as parsed JSON: { error } in words, or { canon (the network as kept, its fields in a fixed
// order), id, meta }. The same checks as the page's (PNET.docError in packages/ppicell/src/sets/pnet.js)
export function parseNet(d, at = Date.now()) {
  if (!isObj(d) || d.v !== 1) return { error: 'the body is a shared network: { v: 1, name, prot, kinds, a, b, k, s? } (relay/README.md, "Shared networks")' };
  if (typeof d.name !== 'string' || !d.name.trim() || d.name.length > 120 || CTRL.test(d.name)) return { error: 'name: 1 to 120 characters, no control characters' };
  if (!Array.isArray(d.prot) || !d.prot.length || d.prot.length > MAX_PROT || d.prot.some(x => typeof x !== 'string' || !x || x.length > 40 || CTRL.test(x))) return { error: `prot: 1 to ${MAX_PROT} protein names of at most 40 characters` };
  if (!Array.isArray(d.kinds) || !d.kinds.length || d.kinds.length > MAX_KINDS || d.kinds.some(x => typeof x !== 'string' || !x || x.length > 24 || CTRL.test(x))) return { error: 'kinds: 1 to 7 words of at most 24 characters' };
  const E = Array.isArray(d.a) ? d.a.length : -1, N = d.prot.length, KM = (1 << d.kinds.length) - 1;
  if (E < 1 || E > MAX_LINKS || !Array.isArray(d.b) || d.b.length !== E || !Array.isArray(d.k) || d.k.length !== E) return { error: `a, b, k: lists of 1 to ${MAX_LINKS} links, all as long` };
  for (let i = 0; i < E; i++) {
    const a = d.a[i], b = d.b[i], k = d.k[i];
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= N || b >= N) return { error: `link ${i}: a and b are numbers into prot` };
    if (!Number.isInteger(k) || k < 1 || k > KM) return { error: `link ${i}: k is the link's kind bits, 1 to ${KM}` };
  }
  if (d.s !== undefined && (!Array.isArray(d.s) || d.s.length !== E || d.s.some(x => x !== null && (typeof x !== 'number' || !Number.isFinite(x))))) return { error: 's: a score (a number) or null for every link' };
  const keep = { v: 1, name: d.name, prot: d.prot, kinds: d.kinds, a: d.a, b: d.b, k: d.k, ...(d.s !== undefined ? { s: d.s } : {}) };
  const canon = JSON.stringify(keep), id = idOf(canon);
  return { canon, id, meta: { v: 1, id, name: d.name, n: N, e: E, kinds: d.kinds.length, score: d.s !== undefined, bytes: canon.length, gz: 0, at } };
}

// the listing's row for a network (its meta.json as kept)
export const summary = m => ({ id: m.id, name: m.name, n: m.n, e: m.e, kinds: m.kinds, score: !!m.score, bytes: m.bytes, gz: m.gz, at: m.at });
const newest = (a, b) => b.at - a.at || (a.id < b.id ? -1 : 1);
export const gzip = canon => zlib.gzipSync(Buffer.from(canon), { level: 9 });

// ---- the folder's store. Each method answers like the R2 one: no throwing for a missing network (null / false)
export function folderStore(root) {
  const dirOf = id => path.join(root, id);
  const ids = async () => {
    let ents = [];
    try { ents = await fs.promises.readdir(root, { withFileTypes: true }); } catch { return []; }
    return ents.filter(e => e.isDirectory() && NET_ID.test(e.name)).map(e => e.name);
  };
  const meta = async id => { try { const m = JSON.parse(await fs.promises.readFile(path.join(dirOf(id), META), 'utf8')); return m && m.id === id ? m : null; } catch { return null; } };
  return {
    where: root,
    async count() { return (await ids()).length; },
    async list() { const out = []; for (const id of await ids()) { const m = await meta(id); if (m) out.push(summary(m)); } return out.sort(newest); },
    meta,
    // a new network: its files into a hidden folder of its own, moved into place whole (never half a network listed)
    async put(id, m, gz) {
      await fs.promises.mkdir(root, { recursive: true });
      const tmp = path.join(root, '.tmp-' + crypto.randomBytes(6).toString('hex'));
      await fs.promises.mkdir(tmp);
      try {
        await fs.promises.writeFile(path.join(tmp, DATA), gz);
        await fs.promises.writeFile(path.join(tmp, META), JSON.stringify(m));
        await fs.promises.rename(tmp, dirOf(id));
      } catch (err) { await fs.promises.rm(tmp, { recursive: true, force: true }); if (err.code === 'ENOTEMPTY' || err.code === 'EEXIST') return; throw err; }
    },
    async data(id) { try { return await fs.promises.readFile(path.join(dirOf(id), DATA)); } catch { return null; } },
    async del(id) {
      if (!(await fs.promises.stat(dirOf(id)).catch(() => null))) return false;
      await fs.promises.rm(dirOf(id), { recursive: true, force: true });
      return true;
    },
  };
}

// ---- the R2 store: RX an r2.mjs R2, prefix the key prefix with the trailing slash (R2_PREFIX + '.nets/')
export function r2Store(RX, prefix) {
  const key = (id, rel) => `${prefix}${id}/${rel}`;
  const cache = new Map();   // meta by id and meta.json's etag
  const listing = async () => {
    const r = await RX.listAll(prefix, { limit: 4 * MAX_NETS + 100 });
    const by = new Map();
    for (const o of r.keys) {
      const rest = o.key.slice(prefix.length), i = rest.indexOf('/');
      if (i < 0 || !NET_ID.test(rest.slice(0, i)) || rest.slice(i + 1) !== META) continue;
      by.set(rest.slice(0, i), o.etag + ':' + o.size);
    }
    return by;
  };
  const meta = async id => {
    const b = await RX.get(key(id, META));
    if (!b) return null;
    try { const m = JSON.parse(String(b)); return m && m.id === id ? m : null; } catch { return null; }
  };
  return {
    where: 'r2:' + prefix,
    async count() { return (await listing()).size; },
    async list() {
      const out = [];
      for (const [id, etag] of await listing()) {
        const c = cache.get(id);
        if (c && c.etag === etag) { out.push(c.s); continue; }
        const m = await meta(id);
        if (!m) continue;
        const s = summary(m);
        cache.set(id, { etag, s });
        out.push(s);
      }
      return out.sort(newest);
    },
    meta,
    // (meta.json last: a network is listed only once it is whole)
    async put(id, m, gz) {
      await RX.put(key(id, DATA), gz, { type: 'application/gzip' });
      await RX.put(key(id, META), Buffer.from(JSON.stringify(m)), { type: 'application/json' });
    },
    async data(id) { return RX.get(key(id, DATA)); },
    async del(id) {
      const r = await RX.listAll(key(id, ''));
      if (!r.keys.length) return false;
      await RX.delMany(r.keys.map(o => o.key));
      cache.delete(id);
      return true;
    },
  };
}

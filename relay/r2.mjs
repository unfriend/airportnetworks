// Cloudflare R2, through its S3 API, for the studio's scenes (relay/README.md, "Scenes in Cloudflare R2"): AWS Signature
// Version 4 written with node:crypto alone (no packages): requests signed in their Authorization header (the relay's own
// calls) and presigned links (query auth: a browser downloads a scene's file, or uploads one, straight from and to the
// bucket), and a small client of the operations the relay (relay/server.mjs, --scenes r2) and tools/studio/r2sync.mjs use.
// The signer is checked byte for byte against AWS's own published examples by relay/test-r2.mjs. Nothing here logs, and no
// error it throws carries a signed address or a key: an R2Error says the operation, the status and S3's error code only.
import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';

const sha256 = d => crypto.createHash('sha256').update(d).digest('hex');
const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
export const EMPTY_HASH = sha256('');
export const UNSIGNED = 'UNSIGNED-PAYLOAD';
export const MAX_EXPIRES = 604800;   // a presigned link lives at most 7 days (S3's and R2's limit)

// ---- Signature Version 4
// URI-encode as SigV4 wants it: every byte but A-Z a-z 0-9 - _ . ~ as %XY (UTF-8, upper-case hex), so a space is %20 and a
// plus %2B (scene and file names may hold both). slash: '/' kept as it is (an object key's path, not a query value)
export function uriEncode(s, slash = false) {
  const e = encodeURIComponent(String(s)).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return slash ? e.replace(/%2F/g, '/') : e;
}
// 20130524T000000Z
export const amzDate = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
// the canonical query string: every name and value encoded, sorted by name (then value), name=value joined by &
export function canonicalQuery(q) {
  return (Array.isArray(q) ? q : Object.entries(q)).map(([k, v]) => [uriEncode(k), uriEncode(v ?? '')])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0)).map(([k, v]) => k + '=' + v).join('&');
}
// the same pairs as an address's query (a name without a value written alone: ?delete, ?cors, as S3's own clients send them)
const addressQuery = q => (Array.isArray(q) ? q : Object.entries(q)).map(([k, v]) => (v === '' ? uriEncode(k) : uriEncode(k) + '=' + uriEncode(v))).sort().join('&');
// a header's value as signed: trimmed, runs of white space as one space
const norm = v => (Array.isArray(v) ? v.join(',') : String(v)).trim().replace(/\s+/g, ' ');
const KEYS = new Map();   // the signing keys of the last few days (one a day per secret and region)
function signingKey(secret, d8, region, service) {
  const k = `${d8}\0${region}\0${service}\0${sha256(secret)}`;
  let key = KEYS.get(k);
  if (!key) {
    key = hmac(hmac(hmac(hmac('AWS4' + secret, d8), region), service), 'aws4_request');
    if (KEYS.size > 16) KEYS.delete(KEYS.keys().next().value);
    KEYS.set(k, key);
  }
  return key;
}
function scopeOf(date, region, service) { const t = amzDate(date), d8 = t.slice(0, 8); return { t, d8, scope: `${d8}/${region}/${service}/aws4_request` }; }
function canonical(method, path, cq, h, payload) {
  const names = Object.keys(h).sort(), signed = names.join(';');
  return { signed, text: [method, path, cq, names.map(n => n + ':' + norm(h[n])).join('\n') + '\n', signed, payload].join('\n') };
}
// header auth: the request's headers (host and x-amz-date added; every one given is signed), the Authorization header
// with them. path: the canonical path (already encoded); query: [[name, value]] or an object; payload: the body's SHA-256
// in hex, or UNSIGNED-PAYLOAD
export function sign({ method, host, path, query = [], headers = {}, payload = UNSIGNED, date = new Date(), region = 'auto', service = 's3', id, secret }) {
  const { t, d8, scope } = scopeOf(date, region, service), h = { host, 'x-amz-date': t };
  for (const [k, v] of Object.entries(headers)) h[k.toLowerCase()] = v;
  const c = canonical(method, path, canonicalQuery(query), h, payload);
  const stringToSign = ['AWS4-HMAC-SHA256', t, scope, sha256(c.text)].join('\n');
  const signature = hmac(signingKey(secret, d8, region, service), stringToSign).toString('hex');
  return { canonicalRequest: c.text, stringToSign, signature, signedHeaders: c.signed,
    headers: { ...h, authorization: `AWS4-HMAC-SHA256 Credential=${id}/${scope}, SignedHeaders=${c.signed}, Signature=${signature}` } };
}
// query auth (a presigned link): host and the headers given signed, the payload unsigned; query: the link's own query
// (the X-Amz-* names added), its signature last, as S3 writes them
export function presign({ method, host, path, query = [], headers = {}, date = new Date(), expires, region = 'auto', service = 's3', id, secret }) {
  const { t, d8, scope } = scopeOf(date, region, service), h = { host };
  for (const [k, v] of Object.entries(headers)) h[k.toLowerCase()] = v;
  const signedNames = Object.keys(h).sort().join(';');
  const q = [...(Array.isArray(query) ? query : Object.entries(query)), ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'], ['X-Amz-Credential', `${id}/${scope}`],
    ['X-Amz-Date', t], ['X-Amz-Expires', String(expires)], ['X-Amz-SignedHeaders', signedNames]];
  const cq = canonicalQuery(q), c = canonical(method, path, cq, h, UNSIGNED);
  const stringToSign = ['AWS4-HMAC-SHA256', t, scope, sha256(c.text)].join('\n');
  const signature = hmac(signingKey(secret, d8, region, service), stringToSign).toString('hex');
  return { canonicalRequest: c.text, stringToSign, signature, query: cq + '&X-Amz-Signature=' + signature };
}

// ---- the settings, from the environment only (never the command line: process lists show it). { error } names what is
// missing or wrong, never a key's value
export function r2Config(env = process.env) {
  const v = n => String(env[n] || '').trim(), err = error => ({ error });
  const missing = [...(v('R2_ENDPOINT') ? [] : ['R2_ACCOUNT_ID']), 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'].filter(n => !v(n));
  if (missing.length) return err(`missing ${missing.join(', ')} in the environment (the bucket and its keys are read from there only: relay/README.md, "Scenes in Cloudflare R2")`);
  let endpoint = v('R2_ENDPOINT');
  if (endpoint) {
    let u = null;
    try { u = new URL(endpoint); } catch { /* said below */ }
    const local = u && /^(127\.0\.0\.1|localhost|\[::1\])$/.test(u.hostname);
    if (!u || !(u.protocol === 'https:' || (u.protocol === 'http:' && local)) || (u.pathname !== '/' && u.pathname !== '') || u.search || u.hash || u.username || u.password)
      return err('R2_ENDPOINT takes an address such as https://<account id>.r2.cloudflarestorage.com (https, no path; http only for 127.0.0.1 or localhost, for tests)');
    endpoint = u.origin;
  } else {
    const acct = v('R2_ACCOUNT_ID'), jur = v('R2_JURISDICTION').toLowerCase();
    if (!/^[0-9a-f]{32}$/i.test(acct)) return err('R2_ACCOUNT_ID is the 32-character account ID (the Cloudflare dashboard, R2, Account details)');
    if (jur && !/^[a-z][a-z0-9-]{0,15}$/.test(jur)) return err('R2_JURISDICTION is a jurisdiction such as eu (or empty for none)');
    endpoint = `https://${acct.toLowerCase()}.${jur ? jur + '.' : ''}r2.cloudflarestorage.com`;
  }
  const id = v('R2_ACCESS_KEY_ID'), secret = v('R2_SECRET_ACCESS_KEY'), bucket = v('R2_BUCKET');
  if (/\s/.test(id) || /\s/.test(secret)) return err('R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are the API token\'s Access Key ID and Secret Access Key, without spaces');
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) return err('R2_BUCKET is the bucket\'s name (3 to 63 lower-case letters, digits and -)');
  const prefix = v('R2_PREFIX').replace(/^\/+|\/+$/g, '');
  if (prefix && (prefix.length > 200 || !/^[A-Za-z0-9 _.\-/]+$/.test(prefix) || prefix.split('/').some(s => !s || s.startsWith('.') || /[ .]$/.test(s))))
    return err('R2_PREFIX is a folder in the bucket, such as scenes or studio/scenes (letters, digits, spaces, _ . -; no part starting with a dot)');
  const num = (n, dflt, lo, hi) => { const s = v(n); if (!s) return dflt; const x = Number(s); return x >= lo && x <= hi ? x : NaN; };
  const ttl = num('R2_LINK_TTL', 43200, 60, MAX_EXPIRES), poll = num('R2_POLL', 5, 1, 300);
  if (!Number.isInteger(ttl)) return err(`R2_LINK_TTL is how many seconds a signed link lives: 60 to ${MAX_EXPIRES} (7 days); 43200 (12 hours: an event's day) when not set`);
  if (!(poll > 0)) return err('R2_POLL is how often, in seconds, the bucket is looked at while a page listens for changes: 1 to 300; 5 when not set');
  const u = new URL(endpoint);
  return { endpoint, host: u.host, protocol: u.protocol, bucket, prefix: prefix ? prefix + '/' : '', id, secret, ttl, poll, region: 'auto' };
}

// ---- XML (S3's answers): what the client reads of them
const unxml = s => String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => (e[0] === '#'
  ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'' }[e.toLowerCase()]));
const tagRe = (tag, g) => new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, g ? 'g' : '');
export const xmlAll = (x, tag) => [...String(x).matchAll(tagRe(tag, true))].map(m => m[1]);
export const xmlOne = (x, tag) => { const m = tagRe(tag).exec(String(x)); return m ? unxml(m[1]) : ''; };
export const xmlEsc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&apos;' })[c]);

// an answer the client did not expect: the operation, the status (0: no answer) and S3's error code; never an address
export class R2Error extends Error {
  constructor(op, status, code) { super(`R2 ${op}: ${status ? 'HTTP ' + status : 'no answer'}${code ? ' ' + code : ''}`); this.op = op; this.status = status; this.code = code || ''; }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
export const md5File = file => new Promise((res, rej) => { const h = crypto.createHash('md5'); fs.createReadStream(file).on('error', rej).on('data', d => h.update(d)).on('end', () => res(h.digest('hex'))); });
const sha256File = file => new Promise((res, rej) => { const h = crypto.createHash('sha256'); fs.createReadStream(file).on('error', rej).on('data', d => h.update(d)).on('end', () => res(h.digest('hex'))); });

// ---- the client: path-style addresses (https://<account>.r2.cloudflarestorage.com/<bucket>/<key>), region auto
export class R2 {
  constructor(c) {
    this.c = c;
    this.mod = c.protocol === 'http:' ? http : https;
    this.agent = new this.mod.Agent({ keepAlive: true, maxSockets: 16 });
    const u = new URL(c.endpoint);
    this.hostname = u.hostname.replace(/^\[|\]$/g, ''); this.port = u.port || (c.protocol === 'http:' ? 80 : 443);
  }
  path(key) { return '/' + uriEncode(this.c.bucket) + (key === null ? '' : '/' + uriEncode(key, true)); }
  // one signed request: { status, headers, body } (body a Buffer, or with toFile the bytes written there). A 5xx or no
  // answer is tried once more (bodies are a Buffer or a file, so they can be sent again)
  async send(op, method, key, o = {}) {
    for (let attempt = 0; ; attempt++) {
      if (o.toFile) await fs.promises.rm(o.toFile, { force: true });   // (a download tried again starts afresh)
      let r;
      try { r = await this.once(method, key, o); } catch (err) {
        if (err instanceof R2Error) throw err;
        if (attempt === 0) { await sleep(400); continue; }
        throw new R2Error(op, 0, err.code || 'network');
      }
      if (r.status >= 500 && attempt === 0) { await sleep(400); continue; }
      return r;
    }
  }
  async once(method, key, { query = [], headers = {}, body = null, file = null, toFile = '', max = Infinity, timeout = 60000 }) {
    const path = this.path(key);
    const payload = body ? sha256(body) : file ? await sha256File(file.path) : EMPTY_HASH;
    const s = sign({ method, host: this.c.host, path, query, headers: { ...headers, 'x-amz-content-sha256': payload }, payload, region: this.c.region, id: this.c.id, secret: this.c.secret });
    const qs = addressQuery(query), hd = { ...s.headers };
    if (body) hd['content-length'] = body.length; else if (file) hd['content-length'] = file.size; else if (method === 'PUT' || method === 'POST') hd['content-length'] = 0;
    return new Promise((resolve, reject) => {
      const req = this.mod.request({ host: this.hostname, port: this.port, method, path: path + (qs ? '?' + qs : ''), headers: hd, agent: this.agent });
      req.setTimeout(timeout, () => req.destroy(Object.assign(new Error('timeout'), { code: 'timeout' })));
      req.on('error', reject);
      req.on('response', res => {
        if (toFile && res.statusCode === 200) {
          if (+res.headers['content-length'] > max) { res.destroy(); return resolve({ status: 413, headers: res.headers, body: Buffer.alloc(0) }); }
          let n = 0;
          const out = fs.createWriteStream(toFile, { flags: 'wx' });
          res.on('data', d => { if ((n += d.length) > max) { res.destroy(); out.destroy(); resolve({ status: 413, headers: res.headers, body: Buffer.alloc(0) }); } });
          res.on('error', reject); out.on('error', reject);
          res.on('close', () => { if (!res.complete && n <= max) { out.destroy(); reject(Object.assign(new Error('cut short'), { code: 'cut' })); } });
          out.on('finish', () => { if (n <= max) resolve({ status: 200, headers: res.headers, body: Buffer.alloc(0), bytes: n }); });
          res.pipe(out);
          return;
        }
        const parts = [];
        res.on('data', d => parts.push(d));
        res.on('error', reject);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(parts) }));
      });
      if (body) req.end(body);
      else if (file) fs.createReadStream(file.path).on('error', e => req.destroy(e)).pipe(req);
      else req.end();
    });
  }
  fail(op, r) { return new R2Error(op, r.status, xmlOne(r.body, 'Code')); }
  // ListObjectsV2: { keys: [{ key, size, etag, at }], prefixes, next } (next: the continuation token, '' at the end)
  async list(prefix, { delimiter = '', token = '', max = 1000, after = '' } = {}) {
    const q = [['list-type', '2'], ['max-keys', String(max)]];
    if (prefix) q.push(['prefix', prefix]);
    if (delimiter) q.push(['delimiter', delimiter]);
    if (token) q.push(['continuation-token', token]);
    if (after) q.push(['start-after', after]);
    const r = await this.send('list', 'GET', null, { query: q });
    if (r.status !== 200) throw this.fail('list', r);
    const x = r.body.toString();
    return {
      keys: xmlAll(x, 'Contents').map(c => ({ key: xmlOne(c, 'Key'), size: +xmlOne(c, 'Size') || 0, etag: xmlOne(c, 'ETag').replace(/"/g, ''), at: Date.parse(xmlOne(c, 'LastModified')) || 0 })),
      prefixes: xmlAll(x, 'CommonPrefixes').map(c => xmlOne(c, 'Prefix')),
      next: xmlOne(x, 'IsTruncated') === 'true' ? xmlOne(x, 'NextContinuationToken') : '',
    };
  }
  // every object under a prefix, at most limit of them: { keys, more } (more: the bucket held more than that)
  async listAll(prefix, { limit = 50000 } = {}) {
    const keys = [];
    let token = '';
    do {
      const r = await this.list(prefix, { token });
      keys.push(...r.keys);
      token = r.next;
    } while (token && keys.length < limit);
    return { keys: keys.slice(0, limit), more: !!token || keys.length > limit };
  }
  // one object's size, ETag and time as a listing gives them (the same time the scenes' listing says), or null
  async stat(key) {
    const r = await this.list(key, { max: 1 });
    const o = r.keys[0];
    return o && o.key === key ? o : null;
  }
  // HeadObject: { size, etag, type } or null (its time only to the second: stat gives the listing's, to the ms)
  async head(key) {
    const r = await this.send('head', 'HEAD', key);
    if (r.status === 404) return null;
    if (r.status !== 200) throw new R2Error('head', r.status, '');
    return { size: +r.headers['content-length'] || 0, etag: String(r.headers.etag || '').replace(/"/g, ''), type: String(r.headers['content-type'] || '') };
  }
  async get(key) {
    const r = await this.send('get', 'GET', key);
    if (r.status === 404) return null;
    if (r.status !== 200) throw this.fail('get', r);
    return r.body;
  }
  // an object into a new file (never one that is there), at most max bytes: its size, null when there is none, or
  // { over: true } past max (the file then holds part of it: the caller removes it)
  async getFile(key, file, max = Infinity) {
    const r = await this.send('get', 'GET', key, { toFile: file, max, timeout: 120000 });
    if (r.status === 404) return null;
    if (r.status === 413) return { over: true };
    if (r.status !== 200) throw this.fail('get', r);
    return { bytes: r.bytes };
  }
  // PutObject: src a Buffer or { path, size }; type, cache (Cache-Control) and ifNoneMatch ('*': only when there is none:
  // { exists: true } when there was one)
  async put(key, src, { type = 'application/octet-stream', cache = '', ifNoneMatch = false } = {}) {
    const headers = { 'content-type': type };
    if (cache) headers['cache-control'] = cache;
    if (ifNoneMatch) headers['if-none-match'] = '*';
    const r = await this.send('put', 'PUT', key, Buffer.isBuffer(src) ? { headers, body: src } : { headers, file: src, timeout: 120000 });
    if (r.status === 412) return { exists: true };
    if (r.status !== 200) throw this.fail('put', r);
    return { etag: String(r.headers.etag || '').replace(/"/g, '') };
  }
  // CopyObject (its metadata with it); S3 may say 200 with an error in the body
  async copy(from, to) {
    const r = await this.send('copy', 'PUT', to, { headers: { 'x-amz-copy-source': this.path(from) } });
    if (r.status !== 200 || /<Error>/.test(r.body.toString())) throw this.fail('copy', r);
  }
  async del(key) {
    const r = await this.send('delete', 'DELETE', key);
    if (r.status !== 204 && r.status !== 200 && r.status !== 404) throw this.fail('delete', r);
  }
  // DeleteObjects, a thousand at a time
  async delMany(keys) {
    for (let i = 0; i < keys.length; i += 1000) {
      const body = Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Delete><Quiet>true</Quiet>' + keys.slice(i, i + 1000).map(k => `<Object><Key>${xmlEsc(k)}</Key></Object>`).join('') + '</Delete>');
      const r = await this.send('delete', 'POST', null, { query: [['delete', '']], headers: { 'content-type': 'application/xml', 'content-md5': crypto.createHash('md5').update(body).digest('base64') }, body });
      if (r.status !== 200 || /<Error>/.test(r.body.toString())) throw this.fail('delete', r);
    }
  }
  // GetBucketCors: the rules ([] none), or null when these keys may not read them (an Object Read & Write token cannot)
  async cors() {
    const r = await this.send('cors', 'GET', null, { query: [['cors', '']] });
    if (r.status === 404) return [];
    if (r.status === 403) return null;
    if (r.status !== 200) throw this.fail('cors', r);
    return xmlAll(r.body.toString(), 'CORSRule').map(x => ({ origins: xmlAll(x, 'AllowedOrigin').map(unxml), methods: xmlAll(x, 'AllowedMethod').map(unxml),
      headers: xmlAll(x, 'AllowedHeader').map(unxml), expose: xmlAll(x, 'ExposeHeader').map(unxml), maxAge: +xmlOne(x, 'MaxAgeSeconds') || 0 }));
  }
  // a browser's preflight (OPTIONS, unsigned: preflights carry no credentials) for an object: what the bucket answers
  preflight(key, origin, method, headers = '') {
    return new Promise(resolve => {
      const req = this.mod.request({ host: this.hostname, port: this.port, method: 'OPTIONS', path: this.path(key), agent: this.agent,
        headers: { host: this.c.host, origin, 'access-control-request-method': method, ...(headers ? { 'access-control-request-headers': headers } : {}) } });
      req.setTimeout(15000, () => req.destroy());
      req.on('error', () => resolve({ status: 0, headers: {} }));
      req.on('response', res => { res.resume(); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers })); });
      req.end();
    });
  }
  // a presigned GET for a file, for a browser. Its date is the start of the current hour, or the file's own time when that
  // is later, and it lives until ttl seconds after the end of that hour, so the link is the same all hour (the browser's
  // cache can keep the file, R2's ETag and 304 work), a file changed is a new link, and every link lives at least ttl
  // seconds from now (at most 7 days: a ttl that long gets a link from now, not the same all hour)
  getLink(key, { at = 0, now = Date.now(), ttl = this.c.ttl } = {}) {
    const hour = Math.floor(now / 3600e3) * 3600e3;
    let d = Math.max(hour, Math.min(Math.floor(now / 1000) * 1000, Math.floor((at || 0) / 1000) * 1000));
    let expires = Math.ceil((hour + 3600e3 - d) / 1000) + ttl;
    if (expires > MAX_EXPIRES) { d = Math.floor(now / 1000) * 1000; expires = Math.min(MAX_EXPIRES, ttl); }
    const s = presign({ method: 'GET', host: this.c.host, path: this.path(key), date: new Date(d), expires, region: this.c.region, id: this.c.id, secret: this.c.secret });
    return this.c.endpoint + this.path(key) + '?' + s.query;
  }
  // a presigned PUT for a browser's upload: its type and length signed (the browser sends the length itself, and a body of
  // another size is refused), and If-None-Match: * unless it may replace one. { url, headers }: the headers to send
  putLink(key, { type, size, replace = false, expires = 3600, now = Date.now() }) {
    const headers = { 'Content-Type': type, ...(replace ? {} : { 'If-None-Match': '*' }) };
    const s = presign({ method: 'PUT', host: this.c.host, path: this.path(key), headers: { ...headers, 'Content-Length': String(size) }, date: new Date(now), expires,
      region: this.c.region, id: this.c.id, secret: this.c.secret });
    return { url: this.c.endpoint + this.path(key) + '?' + s.query, headers };
  }
}

// A stand-in for R2's S3 API, for the tests only (relay/test.mjs, relay/test-r2.mjs, tools/collab.mjs --studio): never
// served by the relay and not part of the app. It keeps one bucket in memory and checks every request as S3 does: AWS
// Signature Version 4 in the Authorization header or in the query (a presigned link), with its own made-up keys; a wrong
// signature, a link past its time, a changed path, a body whose SHA-256 is not the one signed: refused with S3's error XML.
// So a broken signer fails the tests. What the relay and the studio use: ListObjectsV2 (prefix, delimiter, max-keys,
// continuation and start-after), GetObject and HeadObject (one byte range, ETag, If-None-Match: 304), PutObject (a signed
// or UNSIGNED-PAYLOAD body, If-None-Match: * for no overwrite; a body cut short stores nothing), CopyObject, DeleteObject,
// DeleteObjects (Content-MD5 checked), GetBucketCors, and CORS as a bucket's rules say (preflights and the answers).
// ETags are MD5 as R2's are for one-part uploads, and times keep their milliseconds. S.quirks, set by a test, makes it
// answer as a store might that the tests cannot reach: refuseSigned (header names a presigned link may not sign: 403
// SignatureDoesNotMatch), fail(method, key, query) (a status to answer instead: a 5xx, a 403), conflict409 (If-None-Match:
// * refused with 409 BlobAlreadyExists, not 412), ignoreIfNoneMatch, dropReply(method, key) (a PUT stored, its answer
// never sent: the connection closed).
//   import { startFake } from './s3fake.mjs'; const S3 = await startFake({ bucket: 'scenes', keys: { ID: 'SECRET' }, cors });
//   node relay/s3fake.mjs --port 8840 --bucket scenes --key ID:SECRET   (by hand: CORS for any origin)
import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalQuery, uriEncode, xmlEsc, xmlAll, xmlOne, MAX_EXPIRES } from './r2.mjs';

const sha256 = d => crypto.createHash('sha256').update(d).digest('hex');
const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
const norm = v => String(v).trim().replace(/\s+/g, ' ');
// the rule a bucket usually wants for the studio (relay/README.md): any origin, GET HEAD PUT, the headers the studio sends
export const STUDIO_CORS = [{ origins: ['*'], methods: ['GET', 'HEAD', 'PUT'], headers: ['Content-Type', 'If-None-Match', 'Range'],
  expose: ['ETag', 'Content-Length', 'Content-Range', 'Accept-Ranges'], maxAge: 3600 }];

export function startFake({ port = 0, host = '127.0.0.1', bucket = 'scenes', keys = {}, cors = STUDIO_CORS, region = 'auto', maxBody = 700 << 20 } = {}) {
  const S = { objects: new Map(), requests: [], cors, now: () => Date.now(), server: null, port: 0, quirks: {} };
  const xml = (res, status, body, extra = {}) => { const b = Buffer.from('<?xml version="1.0" encoding="UTF-8"?>' + body); res.writeHead(status, { 'Content-Type': 'application/xml', 'Content-Length': b.length, ...extra }); res.end(b); };
  const fail = (res, status, code, message, extra) => xml(res, status, `<Error><Code>${code}</Code><Message>${xmlEsc(message)}</Message></Error>`, extra);
  const etagOf = b => crypto.createHash('md5').update(b).digest('hex');
  const httpDate = ms => new Date(ms).toUTCString();
  // put by a test, straight into the bucket (a change made with another tool)
  S.put = (key, body, { type = 'application/octet-stream', at } = {}) => { const b = Buffer.from(body); S.objects.set(key, { body: b, type, etag: etagOf(b), at: at || S.now(), cache: '' }); };
  S.del = key => S.objects.delete(key);
  S.keys = () => [...S.objects.keys()].sort();
  // CORS: the first rule for this origin and method (and the headers asked for, in a preflight)
  const ruleFor = (origin, method, hdrs = []) => (S.cors || []).find(r => r.origins.some(o => o === '*' || o === origin || (o.includes('*') && new RegExp('^' + o.split('*').map(x => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$').test(origin))) &&
    r.methods.includes(method) && hdrs.every(h => r.headers.some(a => a === '*' || a.toLowerCase() === h.toLowerCase())));
  const corsHeads = (req, method) => {
    const o = req.headers.origin;
    if (o === undefined) return {};
    const r = ruleFor(o, method);
    if (!r) return {};
    return { 'Access-Control-Allow-Origin': r.origins.includes('*') ? '*' : o, Vary: 'Origin', ...(r.expose.length ? { 'Access-Control-Expose-Headers': r.expose.join(', ') } : {}) };
  };

  // ---- Signature Version 4, as S3 checks it: the canonical request rebuilt from what came (the key decoded and encoded
  // again, the query sorted), the signing key from this bucket's own secret for the access key named
  function verify(req, rawPath, query, bodyHash) {
    const auth = String(req.headers.authorization || ''), q = new Map(query);
    let id, scope, signed, given, t, payload, cq;
    if (auth) {
      const m = /^AWS4-HMAC-SHA256 Credential=([^/,\s]+)\/([^,\s]+),\s*SignedHeaders=([^,\s]+),\s*Signature=([0-9a-f]{64})$/.exec(auth);
      if (!m) return ['AuthorizationHeaderMalformed', 'the Authorization header is malformed'];
      [, id, scope, signed, given] = m;
      t = String(req.headers['x-amz-date'] || '');
      payload = String(req.headers['x-amz-content-sha256'] || '');
      if (!payload) return ['InvalidRequest', 'x-amz-content-sha256 is missing'];
      if (Math.abs(Date.parse(t.replace(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/, '$1-$2-$3T$4:$5:$6Z')) - S.now()) > 15 * 60e3) return ['RequestTimeTooSkewed', 'the request time is too far from the server\'s'];
      cq = canonicalQuery(query);
    } else if (q.has('X-Amz-Signature')) {
      if (q.get('X-Amz-Algorithm') !== 'AWS4-HMAC-SHA256') return ['AuthorizationQueryParametersError', 'X-Amz-Algorithm'];
      const c = /^([^/]+)\/(.+)$/.exec(q.get('X-Amz-Credential') || '');
      if (!c) return ['AuthorizationQueryParametersError', 'X-Amz-Credential'];
      [, id, scope] = c;
      signed = q.get('X-Amz-SignedHeaders') || ''; given = q.get('X-Amz-Signature'); t = q.get('X-Amz-Date') || '';
      const exp = +q.get('X-Amz-Expires'), at = Date.parse(t.replace(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/, '$1-$2-$3T$4:$5:$6Z'));
      if (!(exp > 0 && exp <= MAX_EXPIRES) || !at) return ['AuthorizationQueryParametersError', 'X-Amz-Expires or X-Amz-Date'];
      if (S.now() > at + exp * 1000) return ['ExpiredRequest', 'Request has expired'];
      payload = 'UNSIGNED-PAYLOAD';
      cq = canonicalQuery(query.filter(([k]) => k !== 'X-Amz-Signature'));
    } else return ['AccessDenied', 'no credentials'];
    const secret = keys[id];
    if (secret === undefined) return ['InvalidAccessKeyId', 'no such access key'];
    const [d8, reg, svc, term] = scope.split('/');
    if (reg !== region || svc !== 's3' || term !== 'aws4_request' || t.slice(0, 8) !== d8) return ['AuthorizationHeaderMalformed', 'the credential scope is wrong'];
    const names = signed.split(';');
    if (!names.includes('host') || names.join(';') !== [...names].sort().join(';')) return ['AuthorizationHeaderMalformed', 'SignedHeaders'];
    if (!auth && (S.quirks.refuseSigned || []).some(n => names.includes(n))) return ['SignatureDoesNotMatch', 'The request signature we calculated does not match the signature you provided'];
    // the path as S3 normalises it: each part decoded, then encoded again
    let path;
    try { path = rawPath.split('/').map(p => uriEncode(decodeURIComponent(p))).join('/'); } catch { return ['InvalidURI', 'a bad escape']; }
    const head = n => { const v = req.headers[n]; return v === undefined ? null : Array.isArray(v) ? v.join(',') : v; };
    if (names.some(n => head(n) === null)) return ['AccessDenied', 'a signed header is missing'];
    const text = [req.method, path, cq, names.map(n => n + ':' + norm(head(n))).join('\n') + '\n', signed, payload].join('\n');
    const sts = ['AWS4-HMAC-SHA256', t, scope, sha256(text)].join('\n');
    const want = hmac(hmac(hmac(hmac(hmac('AWS4' + secret, d8), reg), 's3'), 'aws4_request'), sts).toString('hex');
    if (want !== given) return ['SignatureDoesNotMatch', 'The request signature we calculated does not match the signature you provided'];
    if (payload !== 'UNSIGNED-PAYLOAD' && bodyHash !== null && payload !== bodyHash) return ['XAmzContentSHA256Mismatch', 'the body is not the one signed'];
    return null;
  }

  function handle(req, res, body) {
    const [rawPath, rawQuery = ''] = String(req.url).split('?');
    let query;
    try { query = rawQuery ? rawQuery.split('&').filter(Boolean).map(p => { const i = p.indexOf('='); return i < 0 ? [decodeURIComponent(p), ''] : [decodeURIComponent(p.slice(0, i)), decodeURIComponent(p.slice(i + 1))]; }) : []; }
    catch { return fail(res, 400, 'InvalidArgument', 'a bad query'); }
    const q = new Map(query), segs = rawPath.split('/');
    const rec = { method: req.method, url: req.url, origin: req.headers.origin, headers: { ...req.headers }, auth: req.headers.authorization ? 'header' : q.has('X-Amz-Signature') ? 'query' : 'none', status: 0 };
    S.requests.push(rec);
    if (S.requests.length > 5000) S.requests.shift();
    const send = (status, ...a) => { rec.status = status; return a.length ? fail(res, status, ...a) : status; };
    let b, key;
    try { b = decodeURIComponent(segs[1] || ''); key = segs.length > 2 ? segs.slice(2).map(decodeURIComponent).join('/') : null; } catch { return send(400, 'InvalidURI', 'a bad escape'); }
    // a preflight: by the bucket's CORS rules alone (no credentials)
    if (req.method === 'OPTIONS') {
      const o = req.headers.origin, m = req.headers['access-control-request-method'];
      const hs = String(req.headers['access-control-request-headers'] || '').split(',').map(s => s.trim()).filter(Boolean);
      const r = o !== undefined && m ? ruleFor(o, m, hs) : null;
      if (!r) return send(403, 'AccessForbidden', 'CORSResponse: This CORS request is not allowed.');
      rec.status = 200;
      res.writeHead(200, { 'Access-Control-Allow-Origin': r.origins.includes('*') ? '*' : o, 'Access-Control-Allow-Methods': r.methods.join(', '),
        ...(hs.length ? { 'Access-Control-Allow-Headers': hs.join(', ') } : {}), ...(r.maxAge ? { 'Access-Control-Max-Age': String(r.maxAge) } : {}), Vary: 'Origin', 'Content-Length': 0 });
      return res.end();
    }
    const ch = corsHeads(req, req.method);
    const why = verify(req, rawPath, query, body ? sha256(body) : req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE' ? sha256('') : null);
    if (why) return send(why[0] === 'InvalidAccessKeyId' || why[0] === 'SignatureDoesNotMatch' || why[0] === 'AccessDenied' || why[0] === 'ExpiredRequest' ? 403 : 400, why[0], why[1], ch);
    if (b !== bucket) return send(404, 'NoSuchBucket', 'The specified bucket does not exist', ch);
    const qf = S.quirks.fail ? S.quirks.fail(req.method, key, q) : 0;
    if (qf) return send(qf, qf >= 500 ? 'InternalError' : 'AccessDenied', 'a failure the test asked for', ch);
    if (key === null || key === '') {   // ---- the bucket
      if (req.method === 'GET' && q.has('cors')) {
        if (!S.cors || !S.cors.length) return send(404, 'NoSuchCORSConfiguration', 'The CORS configuration does not exist', ch);
        rec.status = 200;
        return xml(res, 200, '<CORSConfiguration>' + S.cors.map(r => '<CORSRule>' + r.origins.map(o => `<AllowedOrigin>${xmlEsc(o)}</AllowedOrigin>`).join('') + r.methods.map(m => `<AllowedMethod>${m}</AllowedMethod>`).join('') +
          r.headers.map(h => `<AllowedHeader>${xmlEsc(h)}</AllowedHeader>`).join('') + r.expose.map(h => `<ExposeHeader>${xmlEsc(h)}</ExposeHeader>`).join('') + (r.maxAge ? `<MaxAgeSeconds>${r.maxAge}</MaxAgeSeconds>` : '') + '</CORSRule>').join('') + '</CORSConfiguration>', ch);
      }
      if (req.method === 'GET' && q.get('list-type') === '2') {
        const prefix = q.get('prefix') || '', delim = q.get('delimiter') || '', max = Math.min(1000, q.has('max-keys') ? +q.get('max-keys') : 1000);
        let after = q.get('start-after') || '';
        if (q.has('continuation-token')) after = Buffer.from(q.get('continuation-token'), 'base64url').toString();
        const all = S.keys().filter(k => k.startsWith(prefix) && k > after), out = [], pre = [];
        let last = '', more = false;
        for (const k of all) {
          if (out.length + pre.length >= max) { more = true; break; }
          const rest = k.slice(prefix.length), i = delim ? rest.indexOf(delim) : -1;
          if (i >= 0) { const p = prefix + rest.slice(0, i + delim.length); if (!pre.includes(p)) pre.push(p); last = p + '￿'; continue; }
          out.push(k); last = k;
        }
        const o = S.objects;
        rec.status = 200;
        return xml(res, 200, `<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>${bucket}</Name><Prefix>${xmlEsc(prefix)}</Prefix><KeyCount>${out.length + pre.length}</KeyCount><MaxKeys>${max}</MaxKeys>` +
          (delim ? `<Delimiter>${xmlEsc(delim)}</Delimiter>` : '') + `<IsTruncated>${more}</IsTruncated>` +
          out.map(k => `<Contents><Key>${xmlEsc(k)}</Key><LastModified>${new Date(o.get(k).at).toISOString()}</LastModified><ETag>&quot;${o.get(k).etag}&quot;</ETag><Size>${o.get(k).body.length}</Size><StorageClass>STANDARD</StorageClass></Contents>`).join('') +
          pre.map(p => `<CommonPrefixes><Prefix>${xmlEsc(p)}</Prefix></CommonPrefixes>`).join('') +
          (more ? `<NextContinuationToken>${Buffer.from(last).toString('base64url')}</NextContinuationToken>` : '') + '</ListBucketResult>', ch);
      }
      if (req.method === 'POST' && q.has('delete')) {
        const md5 = crypto.createHash('md5').update(body || '').digest('base64');
        if (req.headers['content-md5'] !== md5) return send(400, 'InvalidDigest', 'Content-MD5 does not match the body', ch);
        const ks = xmlAll(String(body), 'Object').map(x => xmlOne(x, 'Key'));
        if (ks.length > 1000) return send(400, 'MalformedXML', 'more than 1000 keys', ch);
        for (const k of ks) S.objects.delete(k);
        rec.status = 200;
        return xml(res, 200, '<DeleteResult>' + (/<Quiet>true<\/Quiet>/.test(String(body)) ? '' : ks.map(k => `<Deleted><Key>${xmlEsc(k)}</Key></Deleted>`).join('')) + '</DeleteResult>', ch);
      }
      return send(405, 'MethodNotAllowed', 'not here', ch);
    }
    // ---- an object
    const obj = S.objects.get(key);
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (!obj) return send(404, 'NoSuchKey', 'The specified key does not exist.', ch);
      const etag = `"${obj.etag}"`, base = { 'Content-Type': obj.type, ETag: etag, 'Last-Modified': httpDate(obj.at), 'Accept-Ranges': 'bytes', ...(obj.cache ? { 'Cache-Control': obj.cache } : {}), ...ch };
      if (String(req.headers['if-none-match'] || '').split(',').some(x => x.trim() === etag || x.trim() === '*')) { rec.status = 304; res.writeHead(304, base); return res.end(); }
      const n = obj.body.length, m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || '').trim());
      if (m && (m[1] || m[2])) {
        const start = m[1] ? +m[1] : Math.max(0, n - +m[2]), end = m[1] && m[2] ? Math.min(+m[2], n - 1) : n - 1;
        if (start >= n || start > end) return send(416, 'InvalidRange', 'The requested range is not satisfiable', { 'Content-Range': `bytes */${n}`, ...ch });
        rec.status = 206;
        res.writeHead(206, { ...base, 'Content-Range': `bytes ${start}-${end}/${n}`, 'Content-Length': end - start + 1 });
        return res.end(req.method === 'HEAD' ? undefined : obj.body.subarray(start, end + 1));
      }
      rec.status = 200;
      res.writeHead(200, { ...base, 'Content-Length': n });
      return res.end(req.method === 'HEAD' ? undefined : obj.body);
    }
    if (req.method === 'PUT') {
      const src = req.headers['x-amz-copy-source'];
      if (src) {   // CopyObject
        let from;
        try { from = decodeURIComponent(String(src)).replace(/^\//, ''); } catch { return send(400, 'InvalidArgument', 'x-amz-copy-source', ch); }
        const i = from.indexOf('/'), o = i > 0 && from.slice(0, i) === bucket ? S.objects.get(from.slice(i + 1)) : null;
        if (!o) return send(404, 'NoSuchKey', 'The specified key does not exist.', ch);
        const at = S.now();
        S.objects.set(key, { ...o, at });
        rec.status = 200;
        return xml(res, 200, `<CopyObjectResult><LastModified>${new Date(at).toISOString()}</LastModified><ETag>&quot;${o.etag}&quot;</ETag></CopyObjectResult>`, ch);
      }
      if (String(req.headers['if-none-match'] || '').trim() === '*' && obj && !S.quirks.ignoreIfNoneMatch) {
        return S.quirks.conflict409 ? send(409, 'BlobAlreadyExists', 'The object already exists', ch) : send(412, 'PreconditionFailed', 'At least one of the pre-conditions you specified did not hold', ch);
      }
      const b2 = body || Buffer.alloc(0);
      S.objects.set(key, { body: b2, type: String(req.headers['content-type'] || 'application/octet-stream'), etag: etagOf(b2), at: S.now(), cache: String(req.headers['cache-control'] || '') });
      if (S.quirks.dropReply && S.quirks.dropReply(req.method, key)) { rec.status = -1; return res.socket.destroy(); }
      rec.status = 200;
      res.writeHead(200, { ETag: `"${etagOf(b2)}"`, 'Content-Length': 0, ...ch });
      return res.end();
    }
    if (req.method === 'DELETE') { S.objects.delete(key); rec.status = 204; res.writeHead(204, ch); return res.end(); }
    return send(405, 'MethodNotAllowed', 'not here', ch);
  }

  S.server = http.createServer((req, res) => {
    // a body, whole (a PUT cut short stores nothing: it never reaches handle)
    const parts = [];
    let n = 0, over = false;
    req.on('data', d => { if ((n += d.length) > maxBody) { over = true; req.destroy(); } else parts.push(d); });
    req.on('end', () => {
      if (over) return;
      const want = req.headers['content-length'];
      if (want !== undefined && +want !== n) return fail(res, 400, 'IncompleteBody', 'the body is not as long as Content-Length says');
      try { handle(req, res, n || req.method === 'PUT' || req.method === 'POST' ? Buffer.concat(parts) : null); } catch (err) { fail(res, 500, 'InternalError', err.message); }
    });
  });
  return new Promise((resolve, reject) => {
    S.server.on('error', reject);
    S.server.listen(port, host, () => {
      S.port = S.server.address().port;
      S.url = `http://${host}:${S.port}`;
      S.close = () => new Promise(r => { S.server.closeAllConnections?.(); S.server.close(() => r()); });
      resolve(S);
    });
  });
}

// by hand: node relay/s3fake.mjs --port 8840 --bucket scenes --key ID:SECRET
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const a = process.argv.slice(2), arg = (n, d) => { const i = a.indexOf('--' + n); return i >= 0 ? a[i + 1] : d; };
  const [id, secret] = String(arg('key', 'FAKEKEYID:FAKESECRET')).split(':');
  const S = await startFake({ port: +arg('port', 8840), bucket: arg('bucket', 'scenes'), keys: { [id]: secret } });
  console.log(`stand-in S3 at ${S.url}, bucket ${arg('bucket', 'scenes')} (for tests only)`);
}

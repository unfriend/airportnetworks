// Test of relay/r2.mjs: node relay/test-r2.mjs (seconds; also run by relay/test.mjs)
// 1. The signer against AWS's own published Signature Version 4 examples for S3 (the "Signature Calculations" examples:
//    GET Object with a byte range, PUT Object, GET Bucket Lifecycle, GET Bucket (List Objects), and the presigned GET),
//    with AWS's example keys (AKIAIOSFODNN7EXAMPLE, wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY): the canonical requests,
//    the strings to sign and the signatures, byte for byte.
// 2. The encoding of keys with spaces, unicode, + and ~, and the client against the stand-in S3 (relay/s3fake.mjs),
//    which checks every signature: listing (prefix, delimiter, continuation), get, head, put (signed body, UNSIGNED-PAYLOAD,
//    a body other than the one signed refused, If-None-Match),
//    copy, delete, delete many, CORS; presigned links accepted, and refused once expired, with their path changed or
//    their body of another size; a wrong secret refused; a link with only its type signed, a store that refuses a signed
//    length, 409 for one there, and a PUT stored with its answer lost then tried again (taken by its MD5).
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sign, presign, uriEncode, canonicalQuery, r2Config, R2, EMPTY_HASH } from './r2.mjs';
import { startFake } from './s3fake.mjs';

let passed = 0, failed = 0;
const ok = (cond, what) => { if (cond) passed++; else { failed++; console.log('  FAIL', what); } };
const AWS = { id: 'AKIAIOSFODNN7EXAMPLE', secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', region: 'us-east-1', date: new Date('2013-05-24T00:00:00Z') };
const HOST = 'examplebucket.s3.amazonaws.com';

// ---- AWS's examples
{
  const s = sign({ ...AWS, method: 'GET', host: HOST, path: '/test.txt', headers: { Range: 'bytes=0-9', 'x-amz-content-sha256': EMPTY_HASH }, payload: EMPTY_HASH });
  ok(s.canonicalRequest === ['GET', '/test.txt', '', `host:${HOST}`, 'range:bytes=0-9', 'x-amz-content-sha256:' + EMPTY_HASH, 'x-amz-date:20130524T000000Z', '',
    'host;range;x-amz-content-sha256;x-amz-date', EMPTY_HASH].join('\n'), 'GET Object: the canonical request');
  ok(s.stringToSign === ['AWS4-HMAC-SHA256', '20130524T000000Z', '20130524/us-east-1/s3/aws4_request', '7344ae5b7ee6c3e7e6b0fe0640412a37625d1fbfff95c48bbb2dc43964946972'].join('\n'), 'GET Object: the string to sign');
  ok(s.signature === 'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41', 'GET Object: the signature f0e8bdb8... (' + s.signature + ')');
  ok(s.headers.authorization === 'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41', 'GET Object: the Authorization header');
}
{
  const body = 'Welcome to Amazon S3.', h = crypto.createHash('sha256').update(body).digest('hex');
  const s = sign({ ...AWS, method: 'PUT', host: HOST, path: '/' + uriEncode('test$file.text', true), payload: h,
    headers: { Date: 'Fri, 24 May 2013 00:00:00 GMT', 'x-amz-storage-class': 'REDUCED_REDUNDANCY', 'x-amz-content-sha256': h } });
  ok(h === '44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072' && s.canonicalRequest === ['PUT', '/test%24file.text', '', 'date:Fri, 24 May 2013 00:00:00 GMT', `host:${HOST}`,
    'x-amz-content-sha256:' + h, 'x-amz-date:20130524T000000Z', 'x-amz-storage-class:REDUCED_REDUNDANCY', '', 'date;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class', h].join('\n'), 'PUT Object: the key test$file.text as /test%24file.text, the canonical request');
  ok(s.stringToSign.split('\n')[3] === '9e0e90d9c76de8fa5b200d8c849cd5b8dc7a3be3951ddb7f6a76b4158342019d' && s.signature === '98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd', 'PUT Object: the signature 98ad7217... (' + s.signature + ')');
}
{
  const s = sign({ ...AWS, method: 'GET', host: HOST, path: '/', query: [['lifecycle', '']], headers: { 'x-amz-content-sha256': EMPTY_HASH }, payload: EMPTY_HASH });
  ok(s.canonicalRequest.split('\n')[2] === 'lifecycle=' && s.stringToSign.split('\n')[3] === '9766c798316ff2757b517bc739a67f6213b4ab36dd5da2f94eaebf79c77395ca' &&
    s.signature === 'fea454ca298b7da1c68078a5d1bdbfbbe0d65c699e0f91ac7a200a0136783543', 'GET Bucket Lifecycle (a query name without a value): the signature fea454ca... (' + s.signature + ')');
}
{
  const s = sign({ ...AWS, method: 'GET', host: HOST, path: '/', query: { prefix: 'J', 'max-keys': '2' }, headers: { 'x-amz-content-sha256': EMPTY_HASH }, payload: EMPTY_HASH });
  ok(s.canonicalRequest.split('\n')[2] === 'max-keys=2&prefix=J' && s.stringToSign.split('\n')[3] === 'df57d21db20da04d7fa30298dd4488ba3a2b47ca3a489c74750e0f1e7df1b9b7' &&
    s.signature === '34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7', 'GET Bucket (List Objects, its query sorted): the signature 34b48302... (' + s.signature + ')');
}
{
  const s = presign({ ...AWS, method: 'GET', host: HOST, path: '/test.txt', expires: 86400 });
  ok(s.stringToSign === ['AWS4-HMAC-SHA256', '20130524T000000Z', '20130524/us-east-1/s3/aws4_request', '3bfa292879f6447bbcda7001decf97f4a54dc650c8942174ae0a9121cf58ad04'].join('\n'), 'presigned GET: the string to sign');
  ok(`https://${HOST}/test.txt?` + s.query === 'https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    'presigned GET: the whole link, signature aeeed9bb... (' + s.signature + ')');
}
// ---- encoding
ok(uriEncode('with space/é ü+x~y(1)!*\'.glb', true) === 'with%20space/%C3%A9%20%C3%BC%2Bx~y%281%29%21%2A%27.glb' && uriEncode('a/b') === 'a%2Fb' &&
  canonicalQuery([['prefix', 'a b/'], ['delimiter', '/'], ['continuation-token', 'x+y=']]) === 'continuation-token=x%2By%3D&delimiter=%2F&prefix=a%20b%2F',
  'keys and query values encoded as SigV4 wants: spaces %20, + %2B, ~ kept, ! * \' ( ) encoded, unicode as UTF-8; / kept in a key, encoded in a query');

// ---- the settings
{
  const base = { R2_ACCOUNT_ID: 'a'.repeat(32), R2_ACCESS_KEY_ID: 'K', R2_SECRET_ACCESS_KEY: 'S', R2_BUCKET: 'my-scenes' };
  const c = r2Config(base), eu = r2Config({ ...base, R2_JURISDICTION: 'eu', R2_PREFIX: '/studio/scenes/', R2_LINK_TTL: '3600', R2_POLL: '2' });
  ok(c.endpoint === `https://${'a'.repeat(32)}.r2.cloudflarestorage.com` && c.prefix === '' && c.ttl === 43200 && c.poll === 5 && c.region === 'auto', 'the endpoint from the account, no prefix, links 12 h, the watch every 5 s');
  ok(eu.endpoint === `https://${'a'.repeat(32)}.eu.r2.cloudflarestorage.com` && eu.prefix === 'studio/scenes/' && eu.ttl === 3600 && eu.poll === 2, 'R2_JURISDICTION=eu: <account>.eu.r2.cloudflarestorage.com; R2_PREFIX a folder');
  const m = r2Config({ R2_SECRET_ACCESS_KEY: 'TOPSECRETVALUE' });
  ok(/missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_BUCKET/.test(m.error) && !m.error.includes('TOPSECRETVALUE'), 'what is missing named, no value shown: ' + m.error);
  const bad = [r2Config({ ...base, R2_ENDPOINT: 'http://example.com' }), r2Config({ ...base, R2_ACCOUNT_ID: 'nope' }), r2Config({ ...base, R2_BUCKET: 'Bad_Bucket' }), r2Config({ ...base, R2_LINK_TTL: '700000' }),
    r2Config({ ...base, R2_PREFIX: 'a/../b' }), r2Config({ ...base, R2_POLL: '0' }), r2Config({ ...base, R2_ACCESS_KEY_ID: 'a b' })];
  ok(bad.every(x => x.error) && r2Config({ ...base, R2_ENDPOINT: 'http://127.0.0.1:9' }).endpoint === 'http://127.0.0.1:9', 'refused: http to another host, a bad account id, bucket, TTL (over 7 days), prefix, poll, a key with a space; http to 127.0.0.1 taken');
}

// ---- the client against the stand-in, which checks every signature
const S3 = await startFake({ bucket: 'scenes', keys: { TESTKEYID: 'test-secret-made-up' } });
try {
  const env = { R2_ENDPOINT: S3.url, R2_ACCESS_KEY_ID: 'TESTKEYID', R2_SECRET_ACCESS_KEY: 'test-secret-made-up', R2_BUCKET: 'scenes' };
  const c = new R2(r2Config(env)), wrong = new R2(r2Config({ ...env, R2_SECRET_ACCESS_KEY: 'not-the-secret' }));
  const K = 'a scene/sounds/é ü+x~(1).wav', body = crypto.randomBytes(5000);
  ok(!(await c.put(K, body, { type: 'audio/wav', ifNoneMatch: true })).exists && (await c.get(K)).equals(body), 'put (a signed body) and get a key with a space, unicode, + ~ ( )');
  ok((await c.put(K, Buffer.from('x'), { ifNoneMatch: true })).exists === true && (await c.get(K)).equals(body), 'If-None-Match: * on one that is there: refused, unchanged');
  for (let i = 0; i < 7; i++) await c.put(`a scene/many/${i}.glb`, Buffer.from(String(i)));
  await c.put('b/x.glb', Buffer.from('b'));
  const st = await c.stat(K), lst = await c.list('a scene/', { delimiter: '/' }), page = await c.list('a scene/many/', { max: 3 }), all = await c.listAll('a scene/');
  ok(st && st.size === 5000 && st.etag === crypto.createHash('md5').update(body).digest('hex') && st.at > 0 && (await c.stat('a scene/sounds/é')) === null, 'stat: size, ETag (MD5) and time; none for a prefix of a key');
  ok(JSON.stringify(lst.prefixes) === '["a scene/many/","a scene/sounds/"]' && page.keys.length === 3 && !!page.next && all.keys.length === 8 && !all.more, 'list: a delimiter\'s prefixes, a page of 3 with a continuation token, all 8 over pages');
  const hd = await c.head(K);
  ok(hd && hd.size === 5000 && hd.etag === st.etag && hd.type === 'audio/wav' && (await c.head('a scene/none.wav')) === null, 'head: size, ETag and type; none for a key that is not there');
  // a header-signed PUT with UNSIGNED-PAYLOAD (taken), and one whose body is not the one signed (refused)
  const host = new URL(S3.url).host, put = (body, payload) => { const s = sign({ method: 'PUT', host, path: '/scenes/u.bin', payload, headers: { 'x-amz-content-sha256': payload }, id: 'TESTKEYID', secret: 'test-secret-made-up' });
    const { host: _h, ...headers } = s.headers; return fetch(S3.url + '/scenes/u.bin', { method: 'PUT', headers, body }); };
  const u1 = await put('unsigned body', 'UNSIGNED-PAYLOAD'), u2 = await put('another body', crypto.createHash('sha256').update('the signed body').digest('hex'));
  ok(u1.status === 200 && (await c.get('u.bin')).toString() === 'unsigned body' && u2.status === 400 && /XAmzContentSHA256Mismatch/.test(await u2.text()), 'a PUT signed with UNSIGNED-PAYLOAD: taken; a body other than the one signed: 400 XAmzContentSHA256Mismatch');
  await c.copy(K, 'a scene/.history/copy.wav');
  ok((await c.get('a scene/.history/copy.wav')).equals(body), 'copy');
  await c.delMany(['a scene/many/0.glb', 'a scene/many/1.glb']); await c.del('a scene/many/2.glb');
  ok((await c.listAll('a scene/many/')).keys.length === 4 && (await c.get('a scene/many/0.glb')) === null, 'delete many, delete one');
  const cr = await c.cors();
  ok(Array.isArray(cr) && cr[0].origins[0] === '*' && cr[0].methods.includes('PUT'), 'GetBucketCors: the rules');
  let refused = null;
  try { await wrong.list(''); } catch (err) { refused = err; }
  ok(refused && refused.status === 403 && refused.code === 'SignatureDoesNotMatch' && !String(refused.message).includes('not-the-secret'), 'a wrong secret: 403 SignatureDoesNotMatch (no key in the error)');
  // presigned links
  const link = c.getLink(K, { at: st.at });
  const g = await fetch(link, { headers: { Origin: 'https://app.example' } });
  ok(g.status === 200 && Buffer.from(await g.arrayBuffer()).equals(body) && g.headers.get('access-control-allow-origin') === '*', 'a presigned GET: its bytes, CORS for any origin');
  const r = await fetch(link, { headers: { Range: 'bytes=10-19' } }), etag = g.headers.get('etag');
  ok(r.status === 206 && (await fetch(link, { headers: { 'If-None-Match': etag } })).status === 304 && c.getLink(K, { at: st.at }) === link, 'a range (206), its ETag (304), and the same link asked again within the hour');
  const h0 = Math.floor(Date.now() / 3600e3) * 3600e3, l1 = c.getLink(K, { at: h0 - 5000, now: h0 + 9000 }), l2 = c.getLink(K, { at: h0 + 5000, now: h0 + 9000 });
  ok(l1 === c.getLink(K, { at: 0, now: h0 + 9000 }) && l2 !== l1 && /X-Amz-Expires=46800&/.test(l1) && /X-Amz-Expires=46795&/.test(l2) && c.getLink(K, { at: h0 + 5000, now: h0 + 3599000 }) === l2,
    'a link dated from the hour, or from a file changed since: then another link; each the same all hour, living until 12 h after its end');
  const moved = link.replace('/a%20scene/', '/b/');
  ok((await fetch(moved)).status === 403, 'a link with its path changed: 403');
  const old = c.getLink(K, { at: 0, now: Date.now() - 8 * 86400e3, ttl: 3600 });
  const ex = await fetch(old);
  ok(ex.status === 403 && /ExpiredRequest/.test(await ex.text()), 'a link past its time: 403 ExpiredRequest');
  const P = c.putLink('a scene/up.glb', { type: 'model/gltf-binary', size: 4 });
  const p1 = await fetch(P.url, { method: 'PUT', headers: P.headers, body: Buffer.from('glTF') });
  const p2 = await fetch(P.url, { method: 'PUT', headers: P.headers, body: Buffer.from('glTF') });
  const P2 = c.putLink('a scene/up2.glb', { type: 'model/gltf-binary', size: 4 });
  const p3 = await fetch(P2.url, { method: 'PUT', headers: P2.headers, body: Buffer.from('glTF and more') });
  const p4 = await fetch(P2.url, { method: 'PUT', headers: { ...P2.headers, 'Content-Type': 'text/html' }, body: Buffer.from('glTF') });
  ok(p1.status === 200 && (await c.get('a scene/up.glb')).toString() === 'glTF' && p2.status === 412 && p3.status === 403 && p4.status === 403 && (await c.get('a scene/up2.glb')) === null,
    `a presigned PUT: stored (${p1.status}); again: 412 (If-None-Match signed); another size or another type: 403 (${p3.status} ${p4.status})`);
  const pre = await fetch(link, { method: 'OPTIONS', headers: { Origin: 'https://app.example', 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type, if-none-match' } });
  ok(pre.status === 200 && /PUT/.test(pre.headers.get('access-control-allow-methods')) && (await c.preflight(K, 'https://app.example', 'GET', 'range')).status === 200, 'preflights by the bucket\'s CORS rule');
  // a link with only its type signed (for a store that refuses the others signed): another size taken, If-None-Match
  // sent unsigned still honoured; byLink as the relay's start sends one
  const T = c.putLink('a scene/t.glb', { type: 'model/gltf-binary', size: 4, sign: 'type' });
  const t1 = await c.byLink('PUT', T.url, T.headers, Buffer.from('glTF, longer')), t2 = await c.byLink('PUT', T.url, T.headers, Buffer.from('glTF'));
  ok(/X-Amz-SignedHeaders=content-type%3Bhost&/.test(T.url) && JSON.stringify(T.headers) === '{"Content-Type":"model/gltf-binary","If-None-Match":"*"}' && t1.status === 200 && t2.status === 412 && t2.code === 'PreconditionFailed' &&
    (await c.get('a scene/t.glb')).toString() === 'glTF, longer', 'sign: type: only its type signed (another size taken), If-None-Match sent all the same (412 the second time); byLink');
  S3.quirks.refuseSigned = ['content-length'];
  const R = c.putLink('a scene/r.glb', { type: 'model/gltf-binary', size: 4 });
  ok((await c.byLink('PUT', R.url, R.headers, Buffer.from('glTF'))).status === 403 && (await c.byLink('PUT', c.putLink('a scene/r.glb', { type: 'model/gltf-binary', size: 4, sign: 'type' }).url, R.headers, Buffer.from('glTF'))).status === 200,
    'a store that refuses a signed length (the stand-in told to): the full link 403, the type-only one taken');
  S3.quirks = {};
  // one there answered 409 (as R2 has been seen to): exists, as 412; a PUT that landed with its answer lost, tried again:
  // 412 then, and the object there is this one (its MD5): it went in
  S3.quirks.conflict409 = true;
  ok((await c.put(K, Buffer.from('y'), { ifNoneMatch: true })).exists === true && (await c.get(K)).equals(body), 'If-None-Match: * answered 409 BlobAlreadyExists: exists, unchanged');
  S3.quirks = {};
  let drops = 0;
  S3.quirks.dropReply = (m, key) => m === 'PUT' && key === 'a scene/lost.glb' && drops++ === 0;
  const lost = crypto.randomBytes(3000), lp = await c.put('a scene/lost.glb', lost, { ifNoneMatch: true });
  S3.quirks.dropReply = (m, key) => m === 'PUT' && key === 'a scene/lost2.glb' && drops++ === 1;
  const tmp = path.join(os.tmpdir(), 'r2test-' + crypto.randomBytes(4).toString('hex')), lost2 = crypto.randomBytes(2000);
  fs.writeFileSync(tmp, lost2);
  let lp2;
  try { lp2 = await c.put('a scene/lost2.glb', { path: tmp, size: lost2.length }, { ifNoneMatch: true }); } finally { fs.rmSync(tmp, { force: true }); }
  const md5 = b => crypto.createHash('md5').update(b).digest('hex');
  ok(drops === 2 && !lp.exists && lp.etag === md5(lost) && (await c.get('a scene/lost.glb')).equals(lost) && !lp2.exists && lp2.etag === md5(lost2),
    'a PUT stored with its answer lost: tried again (412), and taken as this one by its MD5 (a Buffer, a file)');
  S3.quirks = {};
  ok((await c.put('a scene/lost.glb', Buffer.from('other'), { ifNoneMatch: true })).exists === true, 'a first try refused (another file there): exists');
  ok(S3.requests.every(q => !JSON.stringify(q.headers).includes('test-secret-made-up') && !q.url.includes('test-secret-made-up')), 'the secret never sent');
} finally { await S3.close(); }

console.log(`\n${passed} checks passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

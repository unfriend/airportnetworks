// node tools/studio/test-ktx2.mjs
// The studio's compressed textures (tools/studio/engine/ktx2.js) in Node, in seconds, without a browser: the KTX2 container
// written and read (levels laid out smallest first, aligned to 16 bytes, or 1 when supercompressed; its DFD's transfer
// function and alpha), a GLB split and made again with a bufferView replaced (every view 4-byte aligned, the lengths right),
// which images are colour and which data, the mip chain (its sizes to 1 x 1, colour averaged in linear light, a side that is
// odd), the strips (full width, a multiple of 4 rows but the last); and with the basis folder's own encoder and transcoder
// (both run in Node through require), the module's own worker code run in a vm as a worker would run it: a level encoded
// whole and in strips gives the same blocks byte for byte (no zstd), the strips joined with zstd read back by the transcoder
// to the same pixels as the whole, and encode() (a pool that runs that worker code) making a whole chain in strips that the
// transcoder reads back level by level, alpha forced on every strip of a picture with alpha in one strip only.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..'), BASIS_DIR = path.join(REPO, 'basis');
const require = createRequire(import.meta.url);
const makeKTX2 = new Function(fs.readFileSync(path.join(HERE, 'engine/ktx2.js'), 'utf8') + '\nreturn makeKTX2;')();
const K = makeKTX2(null, { basis: () => '' });
let fails = 0, checks = 0;
const ok = (c, what, more) => { checks++; if (!c) { fails++; console.log('FAIL ' + what + (more ? ': ' + more : '')); } };
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// ---- the container
{
  const dfd = new Uint8Array(44); new DataView(dfd.buffer).setUint32(0, 44, true); dfd[12] = 166; dfd[14] = 2; dfd[31] = 3;   // (UASTC, sRGB, RGBA)
  const kvd = new Uint8Array([5, 0, 0, 0, 65, 66, 67, 0, 0]);   // (a key-value pair's length and bytes; its padding is the writer's)
  const head = { vk: 0, ts: 1, sc: 0, dfd, kvd };
  const levels = [{ w: 8, h: 8, parts: [new Uint8Array(32).fill(1), new Uint8Array(32).fill(2)], raw: 64 }, { w: 4, h: 4, parts: [new Uint8Array(16).fill(3)], raw: 16 }, { w: 2, h: 2, parts: [new Uint8Array(16).fill(4)], raw: 16 }, { w: 1, h: 1, parts: [new Uint8Array(16).fill(5)], raw: 16 }];
  const f = K.write(head, levels), P = K.parse(f);
  ok(K.isKTX2(f) && P.w === 8 && P.h === 8 && P.levels === 4 && P.sc === 0 && P.ts === 1 && P.faces === 1, 'the header written and read', JSON.stringify(P));
  ok(P.lv.every((L, i) => L.off % 16 === 0 && L.len === levels[i].parts.reduce((s, p) => s + p.length, 0) && L.raw === L.len), 'each level aligned to 16 bytes, its length and (not supercompressed) uncompressed length', JSON.stringify(P.lv));
  ok(P.lv[3].off < P.lv[2].off && P.lv[2].off < P.lv[1].off && P.lv[1].off < P.lv[0].off, 'the levels laid out smallest first');
  ok(same([...P.data(0)], [...new Array(32).fill(1), ...new Array(32).fill(2)]) && P.data(3).every(v => v === 5), 'each level\'s parts one after another');
  ok(same([...P.dfd], [...dfd]) && same([...P.kvd], [...kvd]), 'its DFD and KVD kept');
  const I = K.info(f);
  ok(I.uastc && I.srgb && I.alpha && I.levels === 4, 'info: UASTC, sRGB, alpha', JSON.stringify(I));
  const g = K.write(Object.assign({}, head, { sc: 2 }), levels), Q = K.parse(g);
  ok(Q.sc === 2 && Q.lv.every((L, i) => L.raw === levels[i].raw) && Q.lv[0].off === Q.lv[1].off + 16, 'supercompressed: aligned to 1 byte, each level\'s uncompressed length as given', JSON.stringify(Q.lv));
  let threw = '';
  try { K.parse(f.slice(0, 120)); } catch (e) { threw = e.message; }
  ok(/shorter than its levels|does not fit/.test(threw), 'a KTX2 cut short refused in words', threw);
  try { K.parse(new Uint8Array(100)); threw = ''; } catch (e) { threw = e.message; }
  ok(threw === 'not a KTX2 file', 'not a KTX2 file', threw);
}

// ---- a GLB: split, a bufferView replaced, made again
{
  const json = { asset: { version: '2.0' }, buffers: [{ byteLength: 24 }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 5 }, { buffer: 0, byteOffset: 8, byteLength: 12 }, { buffer: 0, byteOffset: 20, byteLength: 3 }],
    images: [{ bufferView: 1, mimeType: 'image/png' }], textures: [{ source: 0 }, { source: 0 }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }, { normalTexture: { index: 1 } }] };
  const bin = new Uint8Array(24); bin.set([1, 2, 3, 4, 5], 0); bin.fill(9, 8, 20); bin.set([7, 7, 7], 20);
  const glb = K.glbBuild(json, bin), S = K.glbSplit(glb);
  ok(new DataView(glb).getUint32(8, true) === glb.byteLength && glb.byteLength % 4 === 0 && same([...S.bin], [...bin]) && S.json.images[0].mimeType === 'image/png', 'a GLB made and split again');
  const nb = K.rebin(S.json, S.bin, new Map([[1, new Uint8Array(9).fill(6)]]));
  const V = S.json.bufferViews;
  ok(V.every(v => v.byteOffset % 4 === 0) && V[1].byteLength === 9 && V[2].byteOffset === 20 && S.json.buffers[0].byteLength === nb.length && nb.length % 4 === 0, 'a bufferView replaced: every view 4-byte aligned, the buffer\'s length', JSON.stringify(V));
  ok(same([...nb.subarray(0, 5)], [1, 2, 3, 4, 5]) && nb.subarray(8, 17).every(v => v === 6) && same([...nb.subarray(20, 23)], [7, 7, 7]), 'its bytes where the views say');
  const r = K.roles({ images: [{}, {}, {}], textures: [{ source: 0 }, { source: 1 }, { extensions: { KHR_texture_basisu: { source: 2 } } }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicRoughnessTexture: { index: 1 } }, normalTexture: { index: 1 } }, { emissiveTexture: { index: 2 }, occlusionTexture: { index: 2 } }] });
  ok(r.get(0) === true && r.get(1) === false && r.get(2) === true, 'colour (base colour, emission: sRGB) and data (normals, roughness and metalness: linear); used as both, colour', JSON.stringify([...r]));
  // every texture slot, the materials' extensions' too: a clearcoat or transmission picture is data, a sheen or specular
  // colour colour
  const e = K.roles({ images: [{}, {}, {}, {}], textures: [{ source: 0 }, { source: 1 }, { source: 2 }, { source: 3 }],
    materials: [{ extensions: { KHR_materials_clearcoat: { clearcoatTexture: { index: 0 }, clearcoatNormalTexture: { index: 1 } }, KHR_materials_transmission: { transmissionTexture: { index: 2 } }, KHR_materials_sheen: { sheenColorTexture: { index: 3 } } } }] });
  ok(e.get(0) === false && e.get(1) === false && e.get(2) === false && e.get(3) === true, 'the extensions\' slots: clearcoat and transmission data (linear), a sheen colour sRGB', JSON.stringify([...e]));
  // an image used both ways split: a copy on a new, empty bufferView for its data uses; a texture used only as data pointed
  // at it, one used both ways copied for its data use; its colour uses as they were
  const sj = { bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 4 }], images: [{ bufferView: 0, mimeType: 'image/png', name: 'pic' }], textures: [{ source: 0, sampler: 0 }, { source: 0 }, { source: 0 }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicRoughnessTexture: { index: 2 } }, normalTexture: { index: 0 }, emissiveTexture: { index: 1 } }, { occlusionTexture: { index: 2 } }] };
  const c = K.split(sj, 0), M0 = sj.materials[0];
  ok(c && c.image === 1 && c.view === 1 && sj.images[1].bufferView === 1 && sj.images[1].name === 'pic (data)' && sj.bufferViews[1].byteLength === 0 && sj.textures.length === 4
    && M0.pbrMetallicRoughness.baseColorTexture.index === 0 && M0.emissiveTexture.index === 1 && sj.textures[0].source === 0 && sj.textures[1].source === 0
    && M0.normalTexture.index === 3 && sj.textures[3].source === 1 && sj.textures[3].sampler === 0 && M0.pbrMetallicRoughness.metallicRoughnessTexture.index === 2 && sj.textures[2].source === 1 && sj.materials[1].occlusionTexture.index === 2,
  'an image used as both split: its data uses on a linear copy (a texture used both ways copied, one used as data only pointed at it)', JSON.stringify(sj));
  const sr = K.roles(sj);
  ok(sr.get(0) === true && sr.get(1) === false && K.split(sj, 0) === null && K.split(sj, 1) === null, 'after it, the original colour and the copy data, neither used both ways');
}

// ---- the mip chain and the strips
{
  const sizes = [];
  for (let w = 1004, h = 604; ; w = Math.max(1, w >> 1), h = Math.max(1, h >> 1)) { sizes.push([w, h]); if (w === 1 && h === 1) break; }
  const chain = await K.mips(new Uint8Array(1004 * 604 * 4).fill(200), 1004, 604, true);
  ok(chain.length === 10 && chain.every((L, i) => L.w === sizes[i][0] && L.h === sizes[i][1] && L.data.length === L.w * L.h * 4), 'the chain\'s sizes to 1 x 1 (1,004 x 604: 10 levels)', JSON.stringify(chain.map(L => [L.w, L.h])));
  ok(chain.every(L => L.data.every(v => v === 200)), 'a flat picture stays flat at every level (odd sides too)');
  // colour in linear light: black and white average to 188, not 128; data and alpha to 128
  const two = new Uint8Array([0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0, 255, 255, 255, 255]);
  const c = await K.mips(two.slice(), 2, 2, true), d = await K.mips(two.slice(), 2, 2, false);
  ok(c[1].data[0] === 188 && c[1].data[3] === 128 && d[1].data[0] === 128 && d[1].data[3] === 128, 'colour averaged in linear light (188), data and alpha as they are (128)', JSON.stringify([...c[1].data, ...d[1].data]));
  // an odd side: 3 x 1 to 1 x 1 is the mean of all three, each a third
  const odd = await K.mips(new Uint8Array([30, 0, 0, 255, 60, 0, 0, 255, 90, 0, 0, 255]), 3, 1, false);
  ok(odd.length === 2 && odd[1].data[0] === 60, 'an odd side: each coarser texel the share of the finer ones it covers', JSON.stringify([...odd[1].data]));
  const S = K.strips(8192, 8192, { split: 6 }), T = K.strips(1004, 302, { split: 6 }), U = K.strips(64, 64, { split: 6 });
  const fine = (L, w, h, max) => L[0][0] === 0 && L[L.length - 1][1] === h && L.every((s, i) => (i === L.length - 1 || ((s[1] - s[0]) % 4 === 0 && L[i + 1][0] === s[1])) && w * (s[1] - s[0]) <= max);
  ok(fine(S, 8192, 8192, 4194304) && S.length === 16, '8,192 px: 16 strips of 512 rows (4 million texels each)', JSON.stringify(S.slice(0, 2)));
  ok(fine(T, 1004, 302, 4194304) && T.length === 2, '1,004 x 302: two strips (none under a quarter of a million texels), a multiple of 4 rows but the last', JSON.stringify(T));
  ok(U.length === 1, 'a small level whole', JSON.stringify(U));
}

// ---- the encoder and the transcoder, the module's own worker code run as a worker runs it
const worker = (src, lib) => {
  const replies = [], ctx = { console, performance, WebAssembly, setTimeout, clearTimeout, Promise, Uint8Array, Uint8ClampedArray, ArrayBuffer, Error, String, Math, Number };
  ctx.importScripts = () => { ctx.BASIS = require(lib); };
  ctx.postMessage = m => { const w = replies.shift(); if (w) w(m); };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return { init: d => ctx.onmessage({ data: d }), ask: d => new Promise(res => { replies.push(res); ctx.onmessage({ data: d }); }) };
};
const ENC = path.join(BASIS_DIR, 'basis_encoder.js'), DEC = path.join(BASIS_DIR, 'basis_transcoder.js');
const enc = worker(K.SRC.enc, ENC), dec = worker(K.SRC.dec, DEC);
enc.init({ init: true, js: ENC, mod: await WebAssembly.compile(fs.readFileSync(path.join(BASIS_DIR, 'basis_encoder.wasm'))) });
dec.init({ init: true, js: DEC, wasm: new Uint8Array(fs.readFileSync(path.join(BASIS_DIR, 'basis_transcoder.wasm'))).buffer });
// a test picture: smooth colour, hard edges and grain, alpha 255 but (alpha) its top 8 rows
const picture = (w, h, alpha) => {
  const d = new Uint8Array(w * h * 4);
  let s = 5; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, edge = (x >> 5) % 2 === (y >> 5) % 2 ? 40 : 0, n = (rnd() - 0.5) * 24;
    d[i] = Math.min(255, Math.max(0, 255 * x / w + edge + n)); d[i + 1] = Math.min(255, Math.max(0, 255 * y / h - edge + n)); d[i + 2] = Math.min(255, Math.max(0, 128 + 100 * Math.sin(x / 9) + n)); d[i + 3] = alpha && y < 8 ? 128 : 255;
  }
  return d;
};
const job = (rgba, w, h, o = {}) => enc.ask(Object.assign({ id: Math.random(), rgba: rgba.slice().buffer, w, h, srgb: true, alpha: false, effort: K.EFFORT, zstd: false }, o));
const read = (bytes, max) => dec.ask({ id: Math.random(), bytes: bytes.slice().buffer, max: max || 0 });
{
  const W = 260, H = 132, px = picture(W, H, false);
  const whole = await job(px, W, H);
  ok(whole.ok, 'the encoder runs (a level whole)', whole.err);
  const parts = [];
  for (const [y0, y1] of [[0, 48], [48, 100], [100, 132]]) { const r = await job(px.slice(y0 * W * 4, y1 * W * 4), W, y1 - y0); parts.push(K.parse(new Uint8Array(r.bytes)).data(0).slice()); }
  const Wd = K.parse(new Uint8Array(whole.bytes)).data(0), J = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { J.set(p, o); o += p.length; }
  ok(Wd.length === Math.ceil(W / 4) * Math.ceil(H / 4) * 16 && same([...Wd], [...J]), 'a level in three strips (48, 52 and 32 rows): the same blocks, byte for byte, as encoded whole (no zstd)');
  // with zstd: each strip its own frame, joined; read back by the transcoder to the same pixels as the whole
  const wz = await job(px, W, H, { zstd: true }), sz = [];
  let head = null, raw = 0;
  for (const [y0, y1] of [[0, 48], [48, 100], [100, 132]]) { const r = await job(px.slice(y0 * W * 4, y1 * W * 4), W, y1 - y0, { zstd: true }); const P = K.parse(new Uint8Array(r.bytes)); head = head || P; sz.push(P.data(0).slice()); raw += P.lv[0].raw; }
  const joined = K.write(head, [{ w: W, h: H, parts: sz, raw }]), a = await read(new Uint8Array(wz.bytes)), b = await read(joined);
  ok(a.ok && b.ok && a.w === W && b.h === H && same([...new Uint8Array(a.data)], [...new Uint8Array(b.data)]), 'with zstd, the strips joined read back by the transcoder to the same pixels as the whole', JSON.stringify([a.err, b.err]));
  let se = 0; const A = new Uint8Array(a.data);
  for (let i = 0; i < A.length; i += 4) for (let k = 0; k < 3; k++) se += (A[i + k] - px[i + k]) ** 2;
  const psnr = 10 * Math.log10(255 * 255 / (se / (W * H * 3)));
  ok(psnr > 35, 'and close to the picture (PSNR over 35 dB)', psnr.toFixed(1));
  console.log(`  a ${W} x ${H} level whole and in strips: the same blocks; read back ${psnr.toFixed(1)} dB from the picture`);
}
{
  // encode(): the whole chain in strips through a pool that runs the worker code, read back level by level; alpha in the
  // top strip only, forced on every strip, so they agree
  const W = 512, H = 520, px = picture(W, H, true);
  let ran = 0;
  const pool = { n: 2, run: m => { ran++; const d = Object.assign({}, m, { rgba: typeof m.rgba === 'function' ? m.rgba() : m.rgba, id: ran }); return enc.ask(d); } };
  const r = await K.encode(px, W, H, { pool, srgb: true, alpha: true, stripMax: 65536 });
  const I = K.info(r.bytes);
  ok(r.levels === 10 && r.strips > r.levels && ran === r.strips, 'encode(): every level in strips through the pool', JSON.stringify({ levels: r.levels, strips: r.strips, ran }));
  ok(I.uastc && I.srgb && I.alpha && I.sc === 2 && I.w === W && I.h === H && I.levels === 10, 'its KTX2: UASTC, sRGB, alpha (forced on every strip), zstd', JSON.stringify(I));
  const L0 = await read(r.bytes), L4 = await read(r.bytes, 64);
  ok(L0.ok && L0.level === 0 && L0.w === W && L0.h === H && L0.alpha, 'read back: level 0 whole, alpha kept', JSON.stringify([L0.err, L0.level, L0.w, L0.h, L0.alpha]));
  ok(L4.ok && L4.level === 4 && L4.w === 32 && L4.h === 32 && same(L4.full, [W, H]), 'read back at most 64 px: the largest level at most that (4: 32 x 32; level 3 is 64 x 65)', JSON.stringify([L4.level, L4.w, L4.h, L4.full]));
  const D = new Uint8Array(L0.data);
  ok(D[3] < 200 && D[(9 * W) * 4 + 3] === 255, 'alpha where it was (the top rows half see-through, the rest opaque)', JSON.stringify([D[3], D[(9 * W) * 4 + 3]]));
  // (levels 0, 3 and 4 read back as each level of the chain made here reads back encoded whole on its own, pixel for pixel:
  // the strips and the levels are where they belong, whatever the codec makes of the content)
  const chain = await K.mips(px.slice(), W, H, true);
  for (const L of [0, 3, 4]) {
    const one = await job(chain[L].data, chain[L].w, chain[L].h, { alpha: true, zstd: true }), a = await read(new Uint8Array(one.bytes)), b = await read(r.bytes, Math.max(chain[L].w, chain[L].h));
    ok(a.ok && b.ok && b.level === L && same([...new Uint8Array(a.data)], [...new Uint8Array(b.data)]), `level ${L} of the chain read back as that level encoded on its own`, JSON.stringify([a.err, b.err, b.level]));
  }
}
console.log(`${checks - fails} of ${checks} checks ${fails ? 'passed, ' + fails + ' FAILED' : 'passed'}`);
process.exit(fails ? 1 : 0);

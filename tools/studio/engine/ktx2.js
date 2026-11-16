// ==================================================================== KTX2 ==
// Compressed textures (tools/studio/SPEC.md, "Compressed textures (KTX2)"; the owner, 16 November 2026: "yes build it,
// encoding in browser since that can be done on a desktop and be fast"). A GLB the converter writes may carry its
// pictures as KTX2 (glTF's KHR_texture_basisu: Basis Universal UASTC LDR 4x4, zstd), which a headset transcodes as it
// loads them to what its GPU keeps compressed (ASTC 4x4 on a Quest: 8 bits a pixel, a quarter of RGBA's 32), so its
// textures may be 8,192 px where raw ones were held to 2,048. Plain JavaScript, one module in three places: the studio
// (pasted into stories/studio.js before the converter by tools/studio/build.mjs), tools/studio/convert.mjs's headless
// page and tools/studio/test-ktx2.mjs (Node: the container, the GLB, the mips and the strips, and encoding and decoding
// with the basis folder's own encoder and transcoder). makeKTX2(THREE, hooks) gives:
//   isKTX2(bytes), parse(bytes), write(head, levels), info(bytes)   the container: a KTX2 file read (its levels, DFD, KVD)
//                       and written (levels laid out smallest first, as KTX2 has them)
//   glbSplit(buf), glbBuild(json, bin), roles(json), split(json, i)   a GLB's JSON and BIN, a GLB made again from them
//                       (every bufferView 4-byte aligned), which images are colour (sRGB) and which data (linear) by every
//                       texture slot of the materials and their extensions (slotsOf, uses), and an image used as both
//                       given a linear copy for its data uses
//   mips(rgba, w, h, srgb, pace)   the mip chain down to 1 x 1 (a box filter, in linear light for colour)
//   strips(w, h, o)     one level cut into full-width strips (each a multiple of 4 rows but the last)
//   pool(n), encode(rgba, w, h, o)   the encoder's workers, and one picture made a KTX2 by them (every level in strips)
//   capture(fn)         the exporter's pictures taken as it writes them (fn: GLTFExporter.parse, run at once)
//   glb(buf, caps, o)   a GLB whose pictures were captured, its images made KTX2 and its glTF rewritten
//   decode(bytes, max), decoder(o), of(canvas)   a KTX2 picture read back to RGBA (the level nearest under max), a loader
//                       that hands GLTFLoader such pictures as plain textures (the converter's reading: everything that
//                       re-exports or reads pixels), and what a picture read so was
//   can(), stop()       whether this page can encode (workers, WebAssembly), and every worker stopped (the studio's dispose)
// hooks.basis(): the address of the app's basis/ folder (the encoder and transcoder, served next to the app), ending in /.
//
// The encoder (Basis Universal's WebAssembly build) refuses more than 12,582,912 texels in one encode, mipmaps included,
// so a 4,096 px picture with its mips cannot be encoded whole. UASTC is made 4 x 4 block by block, each on its own (no
// rate-distortion pass: it is off), so a level is cut into full-width strips, each strip encoded alone (one level, no mips:
// they are made here), and their blocks put one after another make the level exactly as a whole encode would (the proof,
// pixel for pixel, is the spike's; tools/studio/test-ktx2.mjs checks it byte for byte, without zstd). With zstd each
// strip is its own zstd frame and the frames joined are one valid stream. Strips also make it parallel: one encoder a
// worker. The encoder and the transcoder each define a global BASIS, so they never share a scope: the encoder runs in
// this module's workers, the transcoder in its decoder's worker and in three.js's KTX2Loader's own workers.
function makeKTX2(THREE, hooks) {
  const T = THREE, H = hooks || {};
  const base = () => { const b = typeof H.basis === 'function' ? H.basis() : H.basis || ''; return b && !b.endsWith('/') ? b + '/' : b; };
  const u8 = b => (b instanceof Uint8Array ? b : ArrayBuffer.isView(b) ? new Uint8Array(b.buffer, b.byteOffset, b.byteLength) : new Uint8Array(b));
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // ---- the container (KTX 2.0: https://registry.khronos.org/KTX/specs/2.0/ktxspec.v2.html)
  const MAGIC = [0xAB, 0x4B, 0x54, 0x58, 0x20, 0x32, 0x30, 0xBB, 0x0D, 0x0A, 0x1A, 0x0A];
  const isKTX2 = b => { const u = u8(b); if (u.length < 80) return false; for (let i = 0; i < 12; i++) if (u[i] !== MAGIC[i]) return false; return true; };
  // -> { vk, ts, w, h, d, layers, faces, levels, sc, dfd, kvd, lv: [{ off, len, raw }] (largest first), data(i) }
  function parse(b) {
    const u = u8(b);
    if (!isKTX2(u)) throw new Error('not a KTX2 file');
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength), r32 = o => dv.getUint32(o, true), r64 = o => Number(dv.getBigUint64(o, true));
    const K = { vk: r32(12), ts: r32(16), w: r32(20), h: r32(24), d: r32(28), layers: r32(32), faces: r32(36), levels: r32(40), sc: r32(44) };
    const dfdO = r32(48), dfdL = r32(52), kvdO = r32(56), kvdL = r32(60), n = Math.max(1, K.levels);
    if (n > 32 || 80 + n * 24 > u.length || dfdO + dfdL > u.length || kvdO + kvdL > u.length) throw new Error('a KTX2 file whose header does not fit it');
    K.lv = [];
    for (let i = 0; i < n; i++) {
      const o = 80 + i * 24, L = { off: r64(o), len: r64(o + 8), raw: r64(o + 16) };
      if (L.off + L.len > u.length) throw new Error('a KTX2 file shorter than its levels');
      K.lv.push(L);
    }
    K.dfd = u.slice(dfdO, dfdO + dfdL); K.kvd = u.slice(kvdO, kvdO + kvdL);
    K.data = i => u.subarray(K.lv[i].off, K.lv[i].off + K.lv[i].len);
    return K;
  }
  // head: a parsed KTX2 (its format, type size, scheme, DFD and KVD are kept: a strip's); levels: [{ w, h, parts:
  // [Uint8Array...], raw }] largest first, each level's parts one after another. Levels are laid out smallest first, each
  // aligned to 16 bytes (UASTC's block, and 4) unless supercompressed (then 1)
  function write(head, levels) {
    const n = levels.length, sc = head.sc, al = sc ? 1 : 16;
    let o = 80 + 24 * n;
    const dfdO = o; o += head.dfd.length; o = (o + 3) & ~3;
    const kvdO = head.kvd.length ? o : 0; o += head.kvd.length;
    const idx = [];
    for (let i = n - 1; i >= 0; i--) {
      o = Math.ceil(o / al) * al;
      const L = levels[i], len = L.parts.reduce((s, p) => s + p.length, 0);
      idx[i] = { off: o, len, raw: sc ? L.raw : len };
      o += len;
    }
    const out = new Uint8Array(o), dv = new DataView(out.buffer), w32 = (p, v) => dv.setUint32(p, v, true), w64 = (p, v) => dv.setBigUint64(p, BigInt(v), true);
    out.set(MAGIC);
    w32(12, head.vk); w32(16, head.ts); w32(20, levels[0].w); w32(24, levels[0].h); w32(28, 0); w32(32, 0); w32(36, 1); w32(40, n); w32(44, sc);
    w32(48, dfdO); w32(52, head.dfd.length); w32(56, kvdO); w32(60, head.kvd.length); w64(64, 0); w64(72, 0);
    for (let i = 0; i < n; i++) { w64(80 + i * 24, idx[i].off); w64(88 + i * 24, idx[i].len); w64(96 + i * 24, idx[i].raw); }
    out.set(head.dfd, dfdO);
    if (head.kvd.length) out.set(head.kvd, kvdO);
    for (let i = 0; i < n; i++) { let p = idx[i].off; for (const part of levels[i].parts) { out.set(part, p); p += part.length; } }
    return out;
  }
  // what a KTX2 says of itself: its size, levels, whether it is UASTC (the DFD's colour model 166), its transfer function
  // (sRGB: 2) and whether it has alpha (a UASTC DFD's channel: RGBA 3, RRRG 5)
  function info(b) {
    const K = parse(b), D = K.dfd, at = i => (i < D.length ? D[i] : 0);
    const model = at(12), uastc = model === 166, ch = at(31) & 0x0f;
    return { w: K.w, h: K.h, levels: K.lv.length, sc: K.sc, uastc, srgb: at(14) === 2, alpha: uastc ? ch === 3 || ch === 5 : false, bytes: u8(b).length };
  }

  // ---- a GLB: its JSON and BIN, and one made again from them (BIN's bufferViews each 4-byte aligned, in order)
  function glbSplit(buf) {
    const u = u8(buf), dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    if (u.length < 20 || dv.getUint32(0, true) !== 0x46546c67 || dv.getUint32(16, true) !== 0x4e4f534a) throw new Error('not a binary glTF');
    const jl = dv.getUint32(12, true), json = JSON.parse(new TextDecoder().decode(u.subarray(20, 20 + jl)));
    let bin = null, o = 20 + jl;
    while (o + 8 <= u.length) {
      const l = dv.getUint32(o, true), t = dv.getUint32(o + 4, true);
      if (t === 0x004e4942) { bin = u.subarray(o + 8, o + 8 + l); break; }
      o += 8 + l;
    }
    return { json, bin };
  }
  function glbBuild(json, bin) {
    const js = new TextEncoder().encode(JSON.stringify(json)), jp = (4 - (js.length % 4)) % 4, bl = bin ? bin.length : 0, bp = (4 - (bl % 4)) % 4;
    const total = 12 + 8 + js.length + jp + (bin ? 8 + bl + bp : 0), out = new Uint8Array(total), dv = new DataView(out.buffer);
    dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
    dv.setUint32(12, js.length + jp, true); dv.setUint32(16, 0x4e4f534a, true);
    out.set(js, 20); out.fill(0x20, 20 + js.length, 20 + js.length + jp);
    if (bin) { const o = 20 + js.length + jp; dv.setUint32(o, bl + bp, true); dv.setUint32(o + 4, 0x004e4942, true); out.set(bin, o + 8); }
    return out.buffer;
  }
  // the BIN made again with some bufferViews' bytes replaced (repl: bufferView index -> bytes), each view 4-byte aligned
  function rebin(json, bin, repl) {
    const views = json.bufferViews || [], parts = [];
    let o = 0;
    views.forEach((v, i) => {
      const b = repl.has(i) ? repl.get(i) : bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
      o = (o + 3) & ~3;
      parts.push([o, b]); v.byteOffset = o; v.byteLength = b.length; v.buffer = 0;
      o += b.length;
    });
    const out = new Uint8Array((o + 3) & ~3);
    for (const [p, b] of parts) out.set(b, p);
    if (json.buffers && json.buffers[0]) json.buffers[0].byteLength = out.length;
    return out;
  }
  // which texture slots of the materials are colour (sRGB: base colour, emission, and in an extension a diffuse, specular,
  // sheen or diffuse transmission colour) and which data (linear: normals, roughness and metalness, occlusion, and every
  // other slot, the materials' extensions' too: clearcoat, transmission, thickness, iridescence...). slotsOf(json) ->
  // [{ ref (its textureInfo, { index }), colour }]
  const COLOUR_SLOTS = new Set(['baseColorTexture', 'emissiveTexture', 'diffuseTexture', 'specularGlossinessTexture', 'specularColorTexture', 'sheenColorTexture', 'diffuseTransmissionColorTexture']);
  function slotsOf(json) {
    const out = [], walk = o => {
      if (!o || typeof o !== 'object') return;
      for (const k of Object.keys(o)) if (/Texture$/.test(k) && o[k] && typeof o[k] === 'object' && Number.isInteger(o[k].index)) out.push({ ref: o[k], colour: COLOUR_SLOTS.has(k) });
    };
    for (const m of json.materials || []) {
      walk(m); walk(m.pbrMetallicRoughness);
      for (const e of Object.values(m.extensions || {})) walk(e);
    }
    return out;
  }
  const srcOf = t => { const ext = t && t.extensions && t.extensions.KHR_texture_basisu; return t ? (ext ? ext.source : t.source) : undefined; };
  // each image's uses: Map image -> { colour, data }
  function uses(json) {
    const tex = json.textures || [], out = new Map();
    for (const s of slotsOf(json)) {
      const src = srcOf(tex[s.ref.index]);
      if (src === undefined) continue;
      const r = out.get(src) || { colour: false, data: false };
      if (s.colour) r.colour = true; else r.data = true;
      out.set(src, r);
    }
    return out;
  }
  // which images are colour (sRGB) and which data (linear): Map image -> srgb. One no material uses, colour; one used as
  // both, colour here: glb() writes it a second time, linear, for its data uses (split)
  function roles(json) {
    const u = uses(json), srgb = new Map();
    (json.images || []).forEach((im, i) => { const r = u.get(i); srgb.set(i, !r || r.colour || !r.data); });
    return srgb;
  }
  // an image used both as colour and as data given a copy for its data uses (a KTX2 has one transfer function, and its
  // mips are made in linear light for colour only): a new image on a new, empty bufferView (its bytes for rebin to put
  // in), and every data use pointed at it, its texture's source changed or, a texture used as colour too, a copy of that
  // texture made for them. -> { image, view } of the copy, or null when the image is not used both ways
  function split(json, i) {
    const r = uses(json).get(i);
    if (!r || !r.colour || !r.data) return null;
    const tex = json.textures, images = json.images, views = json.bufferViews || (json.bufferViews = []);
    const view = views.push({ buffer: 0, byteOffset: 0, byteLength: 0 }) - 1, im = Object.assign({}, images[i], { bufferView: view });
    if (im.name) im.name += ' (data)';
    const image = images.push(im) - 1;
    const slots = slotsOf(json).filter(s => srcOf(tex[s.ref.index]) === i), col = new Set(slots.filter(s => s.colour).map(s => s.ref.index)), moved = new Map();
    const point = t => { if (t.extensions && t.extensions.KHR_texture_basisu) t.extensions.KHR_texture_basisu.source = image; else t.source = image; return t; };
    for (const s of slots) {
      if (s.colour) continue;
      const ti = s.ref.index;
      if (!moved.has(ti)) moved.set(ti, col.has(ti) ? tex.push(point(JSON.parse(JSON.stringify(tex[ti])))) - 1 : (point(tex[ti]), ti));
      s.ref.index = moved.get(ti);
    }
    return { image, view };
  }

  // ---- the mip chain: a box filter over each 2 x 2 (or, where a side is odd, the share of every texel the coarser one
  // covers), colour in linear light (sRGB to linear and back by tables), alpha and data as they are. Level i is
  // max(1, floor(w / 2^i)) wide, as KTX2 and WebGL have it, down to 1 x 1
  let LIN = null, SRGB = null;
  const tables = () => {
    if (LIN) return;
    LIN = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    SRGB = new Uint8Array(65536);
    for (let i = 0; i < 65536; i++) { const l = i / 65535, c = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055; SRGB[i] = Math.max(0, Math.min(255, Math.round(c * 255))); }
  };
  // (weights along one side: for each coarser texel, the finer texels it covers and their shares)
  const spans = (s, t) => {
    const r = s / t, out = [];
    for (let x = 0; x < t; x++) {
      const a = x * r, b = (x + 1) * r, list = [];
      for (let i = Math.floor(a); i < Math.min(s, Math.ceil(b)); i++) { const w = Math.min(b, i + 1) - Math.max(a, i); if (w > 1e-9) list.push(i, w / r); }
      out.push(list);
    }
    return out;
  };
  function half(src, sw, sh, srgb) {
    const tw = Math.max(1, sw >> 1), th = Math.max(1, sh >> 1), out = new Uint8Array(tw * th * 4);
    const toL = srgb ? LIN : null;
    if (sw === tw * 2 && sh === th * 2) {   // (the usual case: each texel the mean of four)
      for (let y = 0; y < th; y++) {
        const r0 = (2 * y) * sw * 4, r1 = r0 + sw * 4;
        for (let x = 0; x < tw; x++) {
          const a = r0 + x * 8, b = a + 4, c = r1 + x * 8, d = c + 4, o = (y * tw + x) * 4;
          if (toL) for (let k = 0; k < 3; k++) out[o + k] = SRGB[Math.round((toL[src[a + k]] + toL[src[b + k]] + toL[src[c + k]] + toL[src[d + k]]) * 16383.75)];
          else for (let k = 0; k < 3; k++) out[o + k] = (src[a + k] + src[b + k] + src[c + k] + src[d + k] + 2) >> 2;
          out[o + 3] = (src[a + 3] + src[b + 3] + src[c + 3] + src[d + 3] + 2) >> 2;
        }
      }
      return { w: tw, h: th, data: out };
    }
    const X = spans(sw, tw), Y = spans(sh, th), acc = new Float64Array(4);
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      acc.fill(0);
      const ys = Y[y], xs = X[x];
      for (let j = 0; j < ys.length; j += 2) for (let i = 0; i < xs.length; i += 2) {
        const w = ys[j + 1] * xs[i + 1], s = (ys[j] * sw + xs[i]) * 4;
        for (let k = 0; k < 3; k++) acc[k] += (toL ? toL[src[s + k]] : src[s + k]) * w;
        acc[3] += src[s + 3] * w;
      }
      const o = (y * tw + x) * 4;
      for (let k = 0; k < 3; k++) out[o + k] = toL ? SRGB[Math.min(65535, Math.max(0, Math.round(acc[k] * 65535)))] : Math.min(255, Math.round(acc[k]));
      out[o + 3] = Math.min(255, Math.round(acc[3]));
    }
    return { w: tw, h: th, data: out };
  }
  async function mips(rgba, w, h, srgb, pace) {
    tables();
    const out = [{ w, h, data: u8(rgba) }];
    while (out[out.length - 1].w > 1 || out[out.length - 1].h > 1) {
      const L = out[out.length - 1];
      out.push(half(L.data, L.w, L.h, srgb));
      if (pace) await pace();
    }
    return out;
  }

  // ---- strips: one level cut into full-width strips of at most o.max texels (4 million by default), each a multiple of 4
  // rows high but the last, none smaller than o.min texels (a quarter of a million) unless the level is; o.split: as many
  // as wanted for the workers (twice their number), within those bounds. -> [[y0, y1], ...]
  function strips(w, h, o) {
    o = o || {};
    const max = o.max || 4194304, min = o.min || 262144, want = Math.max(1, o.split || 1), total = w * h;
    const per = Math.max(Math.min(max, Math.max(min, Math.ceil(total / want))), 1);
    const rows = Math.max(4, Math.floor(per / w / 4) * 4);
    const out = [];
    for (let y = 0; y < h; y += rows) out.push([y, Math.min(h, y + rows)]);
    return out;
  }

  // (the encoder's effort, 0 to 10. Measured on scan-like pictures, 3 workers on 4 slow cloud cores: efforts 0 and 1 write
  // the same file in the same time (4,096 px 2.5 s, 8,192 px 8 s; 45.2 dB on a busy one, 52.4 on a smoother one); 2 takes
  // 4.5 times as long for at most 0.2 dB, 4 seven times as long for 0.1 to 0.8 dB: none that a headset would show. So the
  // fastest, 1: tools/studio/SPEC.md, "Compressed textures (KTX2)")
  const EFFORT = 1;
  // ---- the encoder's workers: each a worker made from a Blob that imports the served encoder (basis/basis_encoder.js),
  // its WebAssembly compiled once here and given to each. A job: one strip (RGBA, its size, colour or data, alpha forced
  // or not, the effort) -> its KTX2 (one level, UASTC LDR 4x4, zstd)
  const ENC_SRC = `
let M = null, ready = null;
onmessage = async e => {
  const d = e.data;
  if (d.init) {
    ready = (async () => { importScripts(d.js); const m = await BASIS({ instantiateWasm: (imports, cb) => { WebAssembly.instantiate(d.mod, imports).then(cb); return {}; } }); m.initializeBasis(); M = m; })();
    ready.catch(err => postMessage({ fatal: String((err && err.message) || err) }));
    return;
  }
  try { await ready; } catch (err) { postMessage({ id: d.id, ok: false, err: 'the encoder could not start: ' + ((err && err.message) || err) }); return; }
  const t0 = performance.now(), enc = new M.BasisEncoder();
  let n = 0, out = null, psnr = 0;
  try {
    if (enc.setStatusOutput) enc.setStatusOutput(false);   // (its lines of progress, a few a strip, said to no one)
    enc.setCreateKTX2File(true);
    enc.setKTX2UASTCSupercompression(!!d.zstd);
    enc.setFormatModeAndQualityEffort(M.basis_tex_format.cUASTC_LDR_4x4.value, -1, d.effort, true);
    enc.setPerceptual(!!d.srgb); enc.setMipSRGB(!!d.srgb); enc.setKTX2AndBasisSRGBTransferFunc(!!d.srgb);
    enc.setMipGen(false);
    enc.setCheckForAlpha(false); enc.setForceAlpha(!!d.alpha);   // (alpha is the whole picture's: its strips agree)
    if (d.stats) enc.setComputeStats(true);
    enc.setSliceSourceImage(0, new Uint8Array(d.rgba), d.w, d.h, M.ldr_image_type.cRGBA32.value);
    out = new Uint8Array(Math.ceil(d.w / 4) * Math.ceil(d.h / 4) * 17 + 65536);
    n = enc.encode(out);
    if (d.stats && n) psnr = enc.getLastEncodeMip0RGBAPSNR();
  } catch (err) { postMessage({ id: d.id, ok: false, err: String((err && err.message) || err) }); return; } finally { enc.delete(); }
  if (!n) { postMessage({ id: d.id, ok: false, err: 'the encoder refused it' }); return; }
  const bytes = out.slice(0, n).buffer;
  postMessage({ id: d.id, ok: true, bytes, ms: performance.now() - t0, psnr }, [bytes]);
};`;
  const POOLS = new Set();   // (every pool of this module's that is open, for stop())
  let encMod = null;
  const fetchBytes = async url => { const r = await fetch(url); if (!r.ok) throw new Error(`${url.split('/').pop()} could not be fetched (HTTP ${r.status})`); return r.arrayBuffer(); };
  const once = (k, f) => { const P = once.m || (once.m = new Map()); if (!P.has(k)) P.set(k, f().catch(e => { P.delete(k); throw e; })); return P.get(k); };
  const workers = () => {
    const c = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 2;
    return Math.max(1, Math.min(6, c - 1));
  };
  const can = () => typeof Worker === 'function' && typeof WebAssembly === 'object' && typeof Blob === 'function' && typeof URL !== 'undefined' && !!base();
  // n workers (workers(): the computer's cores less one, at most 6); run(job) -> its answer, the jobs queued while all are
  // busy (a job's rgba a function: its strip is cut from its level only as a worker takes it, so the strips of an 8,192 px
  // picture are never all copied at once); close() stops them, and what waits fails
  async function pool(n) {
    n = n || workers();
    if (!can()) throw new Error('this page cannot compress textures (no web workers or WebAssembly)');
    // (its WebAssembly compiled once here and given to each worker, which only instantiates it: this build of the encoder
    // reads no wasmBinary, but takes an instantiateWasm)
    if (!encMod) encMod = await once('enc', () => fetchBytes(base() + 'basis_encoder.wasm').then(b => WebAssembly.compile(b)));
    const src = URL.createObjectURL(new Blob([ENC_SRC], { type: 'text/javascript' })), js = base() + 'basis_encoder.js';
    const P = { n, q: [], idle: [], all: [], wait: new Map(), id: 0, dead: '' };
    const fail = why => { P.dead = P.dead || why; for (const [, w] of P.wait) w.rej(new Error(why)); P.wait.clear(); for (const j of P.q) j.rej(new Error(why)); P.q.length = 0; };
    const send = (W, j) => {
      const m = Object.assign({}, j.msg);
      if (typeof m.rgba === 'function') m.rgba = m.rgba();
      W.job = j; P.wait.set(m.id, j);
      W.w.postMessage(m, [m.rgba]);
    };
    for (let i = 0; i < n; i++) {
      const W = { w: new Worker(src), job: null };
      W.w.onmessage = e => {
        const d = e.data;
        if (d.fatal) { fail('the texture encoder could not start: ' + d.fatal); return; }
        const j = P.wait.get(d.id);
        P.wait.delete(d.id); W.job = null;
        if (j) { if (d.ok) j.res(d); else j.rej(new Error(d.err || 'a texture could not be compressed')); }
        if (P.dead) return;
        const nx = P.q.shift();
        if (nx) send(W, nx); else P.idle.push(W);
      };
      W.w.onerror = e => { if (e && e.preventDefault) e.preventDefault(); fail('the texture encoder stopped: ' + ((e && e.message) || 'an error in its worker')); };
      W.w.postMessage({ init: true, js, mod: encMod });
      P.all.push(W); P.idle.push(W);
    }
    P.run = msg => new Promise((res, rej) => {
      if (P.dead) { rej(new Error(P.dead)); return; }
      const j = { msg: Object.assign({}, msg, { id: ++P.id }), res, rej }, W = P.idle.shift();
      if (W) send(W, j); else P.q.push(j);
    });
    P.close = why => { for (const W of P.all) W.w.terminate(); P.all = []; P.idle = []; URL.revokeObjectURL(src); POOLS.delete(P); fail(why || 'stopped'); };
    POOLS.add(P);
    return P;
  }
  // one picture (RGBA, w x h, both multiples of 4 for its strips to line up; level 0 of its chain) made a KTX2: its mip
  // chain made here, every level cut into strips, each strip encoded by the pool, the strips' blocks joined level by level.
  // o: { pool, srgb, alpha (forced on every strip: a picture with any alpha below 255 has it everywhere, so its strips
  // agree), effort, zstd (on: KHR_texture_basisu's usual), pace, progress(done share), stats } -> { bytes, ms, levels,
  // strips, psnr (level 0's, the strips' texel-weighted mean of the encoder's own measure; o.stats) }
  async function encode(rgba, w, h, o) {
    const t0 = now(), P = o.pool, zstd = o.zstd !== false;
    const chain = o.chain || await mips(rgba, w, h, !!o.srgb, o.pace);
    const jobs = [], total = chain.reduce((s, L) => s + L.w * L.h, 0);
    let done = 0;
    chain.forEach((L, li) => {
      for (const [y0, y1] of strips(L.w, L.h, { split: P.n * 2, max: o.stripMax })) {
        jobs.push({ li, y0, n: L.w * (y1 - y0), msg: { rgba: () => L.data.slice(y0 * L.w * 4, y1 * L.w * 4).buffer, w: L.w, h: y1 - y0, srgb: !!o.srgb, alpha: !!o.alpha, effort: o.effort === undefined ? EFFORT : o.effort, zstd, stats: !!o.stats } });
      }
    });
    // (the big strips first, so the pool ends together)
    const order = jobs.slice().sort((a, b) => b.n - a.n);
    const res = await Promise.all(order.map(j => P.run(j.msg).then(r => { done += j.n; if (o.progress) o.progress(done / total); j.r = r; return r; })));
    let head = null, psnrW = 0, psnrS = 0;
    const levels = chain.map(L => ({ w: L.w, h: L.h, parts: [], raw: 0 }));
    for (const j of jobs) {
      const K = parse(j.r.bytes);
      if (K.lv.length !== 1 || K.w !== levels[j.li].w) throw new Error('a strip came back unlike its level');
      if (!head) head = K;
      else if (K.vk !== head.vk || K.sc !== head.sc || K.dfd.length !== head.dfd.length || !K.dfd.every((v, i) => v === head.dfd[i])) throw new Error('the strips of a texture came back unlike each other');
      levels[j.li].parts.push(K.data(0).slice());
      levels[j.li].raw += K.lv[0].raw || K.lv[0].len;
      if (j.li === 0 && j.r.psnr) { psnrW += j.n; psnrS += j.r.psnr * j.n; }
    }
    return { bytes: write(head, levels), ms: now() - t0, levels: levels.length, strips: jobs.length, psnr: psnrW ? psnrS / psnrW : 0, workerMs: res.reduce((s, r) => s + (r.ms || 0), 0) };
  }

  // ---- the exporter's pictures, taken as it writes them. GLTFExporter (r128) draws each picture on a canvas of its own
  // (flipped as the glTF wants, drawn down to its limit) and calls canvas.toBlob for its PNG or JPEG, all within its parse
  // call; while fn runs (and only then: nothing else can run meanwhile), toBlob takes a copy of the canvas instead and
  // hands back a short tag, the k-th picture's, which the GLB then holds in its k-th image's place. No PNG is made: the
  // picture goes into the KTX2 from the exporter's own pixels
  const TAG = 'KTX2-STUDIO-';
  function capture(fn) {
    const C = typeof HTMLCanvasElement !== 'undefined' ? HTMLCanvasElement.prototype : null, caps = [];
    if (!C) { fn(); return caps; }
    const was = C.toBlob;
    C.toBlob = function (cb) {
      const c = document.createElement('canvas');
      c.width = this.width; c.height = this.height;
      c.getContext('2d').drawImage(this, 0, 0);
      const k = caps.push({ cv: c, w: c.width, h: c.height }) - 1, tag = new Blob([TAG + String(k).padStart(6, '0')]);
      setTimeout(() => cb(tag), 0);
    };
    try { fn(); } finally { C.toBlob = was; }
    return caps;
  }
  const tagOf = b => { let s = ''; for (let i = 0; i < Math.min(b.length, 32); i++) { if (!b[i]) break; s += String.fromCharCode(b[i]); } return s.startsWith(TAG) ? +s.slice(TAG.length) : -1; };
  // RGBA of a captured picture, sized to a multiple of 4 on each side and at most max on its longer side (drawn so on a
  // canvas: a side's few texels more or less stretch it a little, which its texture coordinates do not mind)
  const round4 = v => Math.max(4, Math.round(v / 4) * 4);
  function pixelsOf(cap, max) {
    let w = cap.w, h = cap.h;
    const k = Math.min(1, max / Math.max(w, h));
    const tw = round4(w * k), th = round4(h * k);
    let c = cap.cv;
    if (tw !== w || th !== h) {
      const d = document.createElement('canvas');
      d.width = tw; d.height = th;
      const x = d.getContext('2d');
      x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, tw, th);
      c.width = c.height = 0; c = d; w = tw; h = th;
    }
    const data = new Uint8Array(c.getContext('2d').getImageData(0, 0, w, h).data.buffer);
    c.width = c.height = 0;   // (its memory back)
    return { w, h, data, was: [cap.w, cap.h] };
  }
  // a GLB the exporter wrote while capture() held its pictures (caps): each image whose bytes are a tag made a KTX2 from its
  // picture, its textures given KHR_texture_basisu with no other source, the extension used and required, the BIN made
  // again. o: { effort, max (8,192), zstd, step(label, share), stats }. -> { glb, n, ms, before (RGBA bytes with mips),
  // after (bytes on a GPU that keeps them compressed: 1 a texel, with mips), file (the KTX2s' bytes), list: [{ w, h, srgb,
  // alpha, levels, strips, ms, psnr, bytes, copy (a picture's linear copy for its data uses: split) }], workers }
  async function glb(buf, caps, o) {
    o = o || {};
    const t0 = now(), { json, bin } = glbSplit(buf), images = json.images || [], max = o.max || 8192, step = o.step || (() => {});
    const todo = [];
    images.forEach((im, i) => {
      const v = im.bufferView !== undefined && json.bufferViews ? json.bufferViews[im.bufferView] : null;
      if (!v || !bin) return;
      const k = tagOf(bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength));
      if (k < 0) return;   // (a picture not taken by capture: left as it is)
      if (!caps[k] || !caps[k].cv) throw new Error('a texture was not captured as it was written');
      todo.push({ i, k, view: im.bufferView });
    });
    const out = { glb: buf, n: 0, ms: 0, before: 0, after: 0, file: 0, list: [], workers: 0 };
    if (!todo.length) return out;
    // (an image used both as colour and as data: a second, linear copy for its data uses, from the same picture: split)
    const srgbOf = roles(json);
    for (const x of todo.slice()) {
      x.srgb = srgbOf.get(x.i) !== false;
      const c = split(json, x.i);
      if (c) todo.push({ i: c.image, k: x.k, view: c.view, srgb: false, copy: true });
    }
    const byK = new Map();
    for (const x of todo) { if (!byK.has(x.k)) byK.set(x.k, []); byK.get(x.k).push(x); }
    const repl = new Map(), P = await pool(o.workers);
    out.workers = P.n;
    let last = now(), t = 0;
    const pace = async () => { if (now() - last > 30) { await new Promise(r => setTimeout(r, 0)); last = now(); } };
    try {
      for (const [k, xs] of byK) {
        const px = pixelsOf(caps[k], max);
        let alpha = false;
        for (let i = 3; i < px.data.length; i += 4) if (px.data[i] < 255) { alpha = true; break; }
        for (const x of xs) {
          const label = `Compressing texture ${t + 1} of ${todo.length} (${px.w.toLocaleString('en-GB')} × ${px.h.toLocaleString('en-GB')}, KTX2${x.copy ? ', its linear copy for data' : ''})`, at = t;
          step(label, at / todo.length);
          const r = await encode(px.data, px.w, px.h, { pool: P, srgb: x.srgb, alpha, effort: o.effort, zstd: o.zstd, pace, stats: o.stats,
            progress: f => step(`${label}: ${Math.round(f * 100)} %`, (at + f) / todo.length) });
          repl.set(x.view, r.bytes);
          images[x.i].mimeType = 'image/ktx2';
          out.list.push({ w: px.w, h: px.h, was: px.was, srgb: x.srgb, alpha, levels: r.levels, strips: r.strips, ms: Math.round(r.ms), psnr: r.psnr, bytes: r.bytes.length, copy: !!x.copy });
          out.before += (px.w * px.h * 4 * 4) / 3; out.after += (px.w * px.h * 4) / 3; out.file += r.bytes.length;
          t++;
        }
        caps[k].cv = null;
      }
    } finally { P.close(); }
    for (const t of json.textures || []) {
      if (t.source === undefined || !todo.some(x => x.i === t.source)) continue;
      t.extensions = Object.assign({}, t.extensions, { KHR_texture_basisu: { source: t.source } });
      delete t.source;
    }
    for (const k of ['extensionsUsed', 'extensionsRequired']) json[k] = [...new Set((json[k] || []).concat('KHR_texture_basisu'))];
    const nb = rebin(json, bin, repl);
    out.glb = glbBuild(json, nb); out.n = todo.length; out.ms = Math.round(now() - t0);
    return out;
  }

  // ---- reading one back: the transcoder (basis/basis_transcoder.js, three.js r133's) in a worker of its own, one level
  // (the largest at most max px on its longer side) to RGBA. -> { w, h, data, level, levels, full: [w, h], alpha, srgb }
  const DEC_SRC = `
let M = null, ready = null;
onmessage = async e => {
  const d = e.data;
  if (d.init) {
    ready = new Promise((res, rej) => { try { importScripts(d.js); const m = { wasmBinary: d.wasm, onRuntimeInitialized: () => res(m) }; BASIS(m); } catch (err) { rej(err); } }).then(m => { m.initializeBasis(); M = m; });
    ready.catch(() => {});
    return;
  }
  try { await ready; } catch (err) { postMessage({ id: d.id, ok: false, err: 'the transcoder could not start: ' + ((err && err.message) || err) }); return; }
  const f = new M.KTX2File(new Uint8Array(d.bytes));
  try {
    if (!f.isValid()) throw new Error('not a KTX2 file it can read');
    const n = f.getLevels(), W = f.getWidth(), H = f.getHeight();
    let L = 0;
    while (L < n - 1 && d.max && Math.max(Math.max(1, W >> L), Math.max(1, H >> L)) > d.max) L++;
    if (!f.startTranscoding()) throw new Error('it could not be transcoded');
    const li = f.getImageLevelInfo(L, 0, 0), dst = new Uint8Array(f.getImageTranscodedSizeInBytes(L, 0, 0, 13));
    if (!f.transcodeImage(dst, L, 0, 0, 13, 0, -1, -1)) throw new Error('its level ' + L + ' could not be transcoded');
    postMessage({ id: d.id, ok: true, w: li.origWidth, h: li.origHeight, data: dst.buffer, level: L, levels: n, full: [W, H], alpha: !!f.getHasAlpha(), srgb: f.getDFDTransferFunc() === 2 }, [dst.buffer]);
  } catch (err) { postMessage({ id: d.id, ok: false, err: String((err && err.message) || err) }); } finally { f.close(); f.delete(); }
};`;
  const DEC = { w: null, src: '', wait: new Map(), id: 0, t: 0, wasm: null };
  const decStop = () => { clearTimeout(DEC.t); if (DEC.w) DEC.w.terminate(); if (DEC.src) URL.revokeObjectURL(DEC.src); DEC.w = null; DEC.src = ''; for (const [, w] of DEC.wait) w.rej(new Error('stopped')); DEC.wait.clear(); };
  async function decode(bytes, max) {
    if (!can()) throw new Error('this page cannot read KTX2 textures (no web workers or WebAssembly)');
    if (!DEC.w) {
      if (!DEC.wasm) DEC.wasm = await once('dec', () => fetchBytes(base() + 'basis_transcoder.wasm'));
      if (!DEC.w) {
        DEC.src = URL.createObjectURL(new Blob([DEC_SRC], { type: 'text/javascript' }));
        DEC.w = new Worker(DEC.src);
        DEC.w.onmessage = e => { const w = DEC.wait.get(e.data.id); DEC.wait.delete(e.data.id); if (w) { if (e.data.ok) w.res(e.data); else w.rej(new Error('a KTX2 texture could not be read: ' + e.data.err)); } };
        DEC.w.onerror = e => { if (e && e.preventDefault) e.preventDefault(); const why = 'the KTX2 reader stopped: ' + ((e && e.message) || 'an error in its worker'); for (const [, w] of DEC.wait) w.rej(new Error(why)); DEC.wait.clear(); decStop(); };
        DEC.w.postMessage({ init: true, js: base() + 'basis_transcoder.js', wasm: DEC.wasm.slice(0) });
      }
    }
    clearTimeout(DEC.t);
    const id = ++DEC.id, b = u8(bytes).slice().buffer;
    const r = await new Promise((res, rej) => { DEC.wait.set(id, { res, rej }); DEC.w.postMessage({ id, bytes: b, max: max || 0 }, [b]); });
    DEC.t = setTimeout(() => { if (!DEC.wait.size) decStop(); }, 15000);   // (an idle reader goes after a while)
    return { w: r.w, h: r.h, data: new Uint8Array(r.data), level: r.level, levels: r.levels, full: r.full, alpha: r.alpha, srgb: r.srgb };
  }
  // what a picture read back from a KTX2 was (its full size, the level read, whether colour or alpha), for the converter's
  // numbers: a canvas -> { w, h, level, levels, alpha, srgb }
  const OF = new WeakMap(), of = img => (img && OF.get(img)) || null;
  // a loader GLTFLoader takes as its KTX2Loader (setKTX2Loader) that gives each KTX2 picture as a plain texture on a
  // canvas: everything that re-exports, reads pixels or makes pictures works on them as on PNG and JPEG. o.max: the
  // largest level at most that on its longer side is read (a picture for the Add pane needs no 8,192 px)
  function decoder(o) {
    const max = (o && o.max) || 0;
    return {
      isKTX2Decoder: true,
      load(url, onLoad, onProgress, onError) {
        (async () => {
          const r = await fetch(url);
          if (!r.ok) throw new Error('a KTX2 texture could not be fetched (HTTP ' + r.status + ')');
          const d = await decode(await r.arrayBuffer(), max), c = document.createElement('canvas');
          c.width = d.w; c.height = d.h;
          c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(d.data.buffer, d.data.byteOffset, d.data.length), d.w, d.h), 0, 0);
          OF.set(c, { w: d.full[0], h: d.full[1], level: d.level, levels: d.levels, alpha: d.alpha, srgb: d.srgb });
          const t = new T.Texture(c);
          t.needsUpdate = true;
          return t;
        })().then(onLoad, e => { if (onError) onError(e); });
        return null;
      },
    };
  }
  // every worker stopped (the studio's dispose: a conversion under way then fails, as nothing can use it)
  function stop() { for (const P of [...POOLS]) P.close('stopped'); decStop(); }

  return { isKTX2, parse, write, info, glbSplit, glbBuild, rebin, roles, uses, slotsOf, split, mips, half, strips, pool, encode, capture, glb, decode, decoder, of, can, stop, workers, round4, TAG, EFFORT, SRC: { enc: ENC_SRC, dec: DEC_SRC } };
}

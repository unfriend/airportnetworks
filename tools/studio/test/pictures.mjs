// Test pictures for the studio's picture reader (tools/studio/engine/images.js): small writers for the formats it reads
// (TIFF with LZW, PackBits or Deflate, PSD with RLE, DDS as DXT1, DXT5 or BC5) and the pixels they are made from, so
// tools/studio/test/make.mjs writes them into the test scene tools/studio/test/scenes/textures/ and
// tools/studio/test-images.mjs reads them back and compares. Each pixel function gives [r, g, b, a] (0 to 255) at x, y.
import zlib from 'zlib';

// ---- the pixels
export const PX = {
  wood: (x, y) => [Math.round(140 + 60 * Math.sin(x / 5)), Math.round(90 + 40 * Math.sin(y / 7 + x / 9)), Math.round(50 + 20 * Math.cos(x / 4)), 255],
  brick: (x, y) => [Math.round(160 + 50 * Math.sin(y / 3)), Math.round(70 + 20 * Math.cos(x / 5)), 60, Math.round(255 - 4 * x)],
  rough: (x, y) => { const v = Math.round(65535 * ((x + y * 16) / 255)); return [v, v, v, 65535]; },   // (16-bit grey)
  panel: (x, y) => [Math.round(40 + 6 * x), Math.round(200 - 4 * y), 150, Math.round(128 + 3 * x)],
  stone: (x, y) => [Math.round(120 + 60 * Math.sin(x / 6) * Math.cos(y / 7)), Math.round(115 + 50 * Math.cos(x / 8)), Math.round(110 + 40 * Math.sin(y / 5)), 255],
  glass: (x, y) => [Math.round(80 + 4 * x), Math.round(160 + 2 * y), 220, Math.round(60 + 5 * y)],
  // a normal map of gentle bumps: x and y of the normal (z is rebuilt from them), as BC5 keeps them
  bumps: (x, y) => { const nx = 0.35 * Math.sin(x / 4), ny = 0.35 * Math.cos(y / 5), nz = Math.sqrt(1 - nx * nx - ny * ny); return [Math.round((nx * 0.5 + 0.5) * 255), Math.round((ny * 0.5 + 0.5) * 255), Math.round((nz * 0.5 + 0.5) * 255), 255]; },
  height: (x, y) => { const v = Math.round(128 + 100 * Math.sin(x / 3) * Math.sin(y / 3)); return [v, v, v, 255]; },
  paint: (x, y) => [Math.round(200 - 5 * x), 60, Math.round(40 + 9 * y), 255],
  pal: (x, y) => (x >> 2) + 4 * (y >> 2),   // (an index into a 16-colour palette)
};
export const PAL = Array.from({ length: 16 }, (_, i) => [i * 17, 255 - i * 15, (i * 53) % 256]);
const grid = (w, h, f) => { const out = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.push(f(x, y)); return out; };

// ---- PNG (RGBA)
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function png(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(px(x, y), y * (w * 4 + 1) + 1 + x * 4);
  const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4, 'ascii'); d.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---- PackBits: runs of three or more repeated, the rest as they are
export function packbits(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    let r = 1;
    while (i + r < src.length && src[i + r] === src[i] && r < 128) r++;
    if (r >= 3) { out.push(257 - r, src[i]); i += r; continue; }
    const s = i;
    while (i < src.length && i - s < 128 && !(i + 2 < src.length && src[i] === src[i + 1] && src[i] === src[i + 2])) i++;
    out.push(i - s - 1, ...src.subarray(s, i));
  }
  return Buffer.from(out);
}
// ---- TIFF's LZW (codes first bit first, 9 to 12 bits, a bit wider one code early, as TIFF readers expect)
export function lzw(src) {
  const bytes = [];
  let acc = 0, nacc = 0, bits = 9;
  const put = c => { acc = (acc << bits) | c; nacc += bits; while (nacc >= 8) { bytes.push((acc >>> (nacc - 8)) & 255); nacc -= 8; } acc &= (1 << nacc) - 1; };
  let dict = new Map(), next = 258, sent = 0;
  // (the reader adds an entry for every code after the first since a clear, and widens when it is about to fill)
  const after = () => { sent++; const have = 258 + Math.max(0, sent - 1); if (have + 1 >= (1 << bits) && bits < 12) bits++; };
  put(256);
  let cur = -1;
  for (const c of src) {
    if (cur < 0) { cur = c; continue; }
    const k = cur * 256 + c;
    if (dict.has(k)) { cur = dict.get(k); continue; }
    put(cur); after();
    if (next < 4093) dict.set(k, next++);
    else { put(256); dict = new Map(); next = 258; bits = 9; sent = 0; }
    cur = c;
  }
  if (cur >= 0) { put(cur); after(); }
  put(257);
  if (nacc) bytes.push((acc << (8 - nacc)) & 255);
  return Buffer.from(bytes);
}
// ---- TIFF: o = { w, h, spp, bits (8 or 16), photo (1 grey, 2 RGB, 3 palette), comp (1, 5 LZW, 8 Deflate, 32773
// PackBits), pred (2: horizontal), le (little-endian), extra (alpha: 2 unassociated), rows (a strip's rows), cmap, px }
export function tiff(o) {
  const { w, h, spp, bits, photo, comp } = o, le = !!o.le, by = bits / 8, rowB = w * spp * by, rows = o.rows || h;
  const w16 = (b, at, v) => (le ? b.writeUInt16LE(v, at) : b.writeUInt16BE(v, at)), w32 = (b, at, v) => (le ? b.writeUInt32LE(v, at) : b.writeUInt32BE(v, at));
  const raw = Buffer.alloc(rowB * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = photo === 3 ? [o.px(x, y)] : o.px(x, y);
    for (let s = 0; s < spp; s++) { const at = y * rowB + (x * spp + s) * by; if (bits === 8) raw[at] = v[s]; else w16(raw, at, v[s]); }
  }
  if (o.pred === 2) for (let y = h - 1; y >= 0; y--) for (let i = w * spp - 1; i >= spp; i--) {   // (each sample less the one before it)
    const a = y * rowB + i * by, b = y * rowB + (i - spp) * by;
    if (bits === 8) raw[a] = (raw[a] - raw[b]) & 255;
    else { const va = le ? raw.readUInt16LE(a) : raw.readUInt16BE(a), vb = le ? raw.readUInt16LE(b) : raw.readUInt16BE(b); w16(raw, a, (va - vb) & 65535); }
  }
  const strips = [];
  for (let y = 0; y < h; y += rows) {
    const part = raw.subarray(y * rowB, Math.min(h, y + rows) * rowB);
    strips.push(comp === 5 ? lzw(part) : comp === 8 ? zlib.deflateSync(part) : comp === 32773 ? Buffer.concat(Array.from({ length: part.length / rowB }, (_, r) => packbits(part.subarray(r * rowB, (r + 1) * rowB)))) : Buffer.from(part));
  }
  const tags = [[256, 3, [w]], [257, 3, [h]], [258, 3, Array(spp).fill(bits)], [259, 3, [comp]], [262, 3, [photo]], [273, 4, null], [277, 3, [spp]], [278, 3, [rows]], [279, 4, strips.map(s => s.length)], [284, 3, [1]]];
  if (o.pred) tags.push([317, 3, [o.pred]]);
  if (o.cmap) tags.push([320, 3, [0, 1, 2].flatMap(c => o.cmap.map(rgb => rgb[c] * 257))]);
  if (o.extra) tags.push([338, 3, [o.extra]]);
  tags.sort((a, b) => a[0] - b[0]);
  let at = 8;
  const offs = strips.map(s => { const a = at; at += s.length + (s.length & 1); return a; });
  tags.find(t => t[0] === 273)[2] = offs;
  const extraAt = at, big = tags.filter(t => t[2].length * (t[1] === 3 ? 2 : 4) > 4);
  let ea = extraAt;
  const where = new Map(big.map(t => { const a = ea; ea += t[2].length * (t[1] === 3 ? 2 : 4); return [t[0], a]; }));
  const ifd = ea, out = Buffer.alloc(ifd + 2 + tags.length * 12 + 4);
  out.write(le ? 'II' : 'MM', 0, 'ascii'); w16(out, 2, 42); w32(out, 4, ifd);
  strips.forEach((s, i) => s.copy(out, offs[i]));
  for (const t of big) { let a = where.get(t[0]); for (const v of t[2]) { if (t[1] === 3) { w16(out, a, v); a += 2; } else { w32(out, a, v); a += 4; } } }
  w16(out, ifd, tags.length);
  tags.forEach((t, i) => {
    const e = ifd + 2 + i * 12;
    w16(out, e, t[0]); w16(out, e + 2, t[1]); w32(out, e + 4, t[2].length);
    if (where.has(t[0])) w32(out, e + 8, where.get(t[0]));
    else if (t[1] === 3) { w16(out, e + 8, t[2][0]); if (t[2].length > 1) w16(out, e + 10, t[2][1]); }
    else w32(out, e + 8, t[2][0]);
  });
  return out;
}
// a TIFF that says it is JPEG-compressed (the reader refuses it with a sentence; nothing more is needed)
export const tiffJpeg = () => { const b = tiff({ w: 4, h: 4, spp: 3, bits: 8, photo: 2, comp: 1, le: true, px: () => [0, 0, 0] }); const n = b.readUInt16LE(b.readUInt32LE(4)); for (let i = 0; i < n; i++) { const e = b.readUInt32LE(4) + 2 + i * 12; if (b.readUInt16LE(e) === 259) b.writeUInt16LE(7, e + 8); } return b; };

// ---- PSD: the merged picture only, RLE (o.raw: as it is), RGB with an alpha channel, 8 bits (o.mode 1: grey; o.cmyk)
export function psd(o) {
  const { w, h } = o, n = o.mode === 1 ? 1 : o.cmyk ? 4 : o.alpha === false ? 3 : 4, depth = o.depth || 8, by = depth / 8;
  const ch = Array.from({ length: n }, () => Buffer.alloc(w * h * by));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = o.px(x, y);
    // (an RGB picture with alpha: its colours blended over white, as Photoshop keeps the merged picture)
    const al = !o.cmyk && o.mode !== 1 && n === 4 ? v[3] : 255;
    for (let c = 0; c < n; c++) {
      const val = o.cmyk ? 255 - v[c] : c < 3 && al < 255 ? Math.round((v[c] * al) / 255 + 255 - al) : v[c];
      if (by === 1) ch[c][y * w + x] = val; else ch[c].writeUInt16BE(val * 257, (y * w + x) * 2);
    }
  }
  const head = Buffer.alloc(26);
  head.write('8BPS', 0, 'ascii'); head.writeUInt16BE(1, 4); head.writeUInt16BE(n, 12); head.writeUInt32BE(h, 14); head.writeUInt32BE(w, 18); head.writeUInt16BE(depth, 22);
  head.writeUInt16BE(o.mode === 1 ? 1 : o.cmyk ? 4 : 3, 24);
  const zero = Buffer.alloc(12);   // (no colour mode data, image resources or layers)
  if (o.raw) return Buffer.concat([head, zero, Buffer.from([0, 0]), ...ch]);
  const rows = [], counts = Buffer.alloc(n * h * 2);
  ch.forEach((c, ci) => { for (let y = 0; y < h; y++) { const r = packbits(c.subarray(y * w * by, (y + 1) * w * by)); counts.writeUInt16BE(r.length, (ci * h + y) * 2); rows.push(r); } });
  return Buffer.concat([head, zero, Buffer.from([0, 1]), counts, ...rows]);
}

// ---- DDS: DXT1 (BC1), DXT5 (BC3) or ATI2 (BC5) blocks, a simple encoder (the ends of each block's range, the nearest step)
const q565 = c => ((Math.round(c[0] * 31 / 255) << 11) | (Math.round(c[1] * 63 / 255) << 5) | Math.round(c[2] * 31 / 255));
const d565 = v => [((v >> 11) & 31) * 255 / 31, ((v >> 5) & 63) * 255 / 63, (v & 31) * 255 / 31];
function bc1(px) {   // px: 16 [r, g, b]
  const lo = [0, 1, 2].map(c => Math.min(...px.map(p => p[c]))), hi = [0, 1, 2].map(c => Math.max(...px.map(p => p[c])));
  let c0 = q565(hi), c1 = q565(lo);
  if (c0 < c1) [c0, c1] = [c1, c0];
  const b = Buffer.alloc(8);
  b.writeUInt16LE(c0, 0); b.writeUInt16LE(c1, 2);
  if (c0 === c1) return b;
  const a = d565(c0), z = d565(c1), pal = [a, z, a.map((v, i) => (2 * v + z[i]) / 3), a.map((v, i) => (v + 2 * z[i]) / 3)];
  let idx = 0;
  px.forEach((p, k) => { let best = 0, bd = Infinity; pal.forEach((q, j) => { const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (d < bd) { bd = d; best = j; } }); idx |= best << (2 * k); });
  b.writeUInt32LE(idx >>> 0, 4);
  return b;
}
function bc4(vals) {   // 16 values, 0 to 255
  const a0 = Math.max(...vals), a1 = Math.min(...vals), b = Buffer.alloc(8);
  b[0] = a0; b[1] = a1;
  if (a0 === a1) return b;
  const pal = [a0, a1, ...[1, 2, 3, 4, 5, 6].map(k => ((7 - k) * a0 + k * a1) / 7)];
  let bits = 0n;
  vals.forEach((v, k) => { let best = 0, bd = Infinity; pal.forEach((q, j) => { const d = Math.abs(v - q); if (d < bd) { bd = d; best = j; } }); bits |= BigInt(best) << BigInt(3 * k); });
  for (let i = 0; i < 6; i++) b[2 + i] = Number((bits >> BigInt(8 * i)) & 255n);
  return b;
}
export function dds(o) {   // o: { w, h, kind: 'dxt1' | 'dxt5' | 'bc5', px }
  const { w, h, kind } = o, blocks = [];
  for (let by = 0; by < h; by += 4) for (let bx = 0; bx < w; bx += 4) {
    const px = [];
    for (let k = 0; k < 16; k++) px.push(o.px(Math.min(w - 1, bx + (k & 3)), Math.min(h - 1, by + (k >> 2))));
    if (kind === 'dxt1') blocks.push(bc1(px));
    else if (kind === 'dxt5') blocks.push(bc4(px.map(p => p[3])), bc1(px));
    else blocks.push(bc4(px.map(p => p[0])), bc4(px.map(p => p[1])));
  }
  const head = Buffer.alloc(128), data = Buffer.concat(blocks);
  head.write('DDS ', 0, 'ascii'); head.writeUInt32LE(124, 4); head.writeUInt32LE(0x81007, 8); head.writeUInt32LE(h, 12); head.writeUInt32LE(w, 16); head.writeUInt32LE(data.length, 20);
  head.writeUInt32LE(32, 76); head.writeUInt32LE(4, 80); head.write({ dxt1: 'DXT1', dxt5: 'DXT5', bc5: 'ATI2' }[kind], 84, 'ascii'); head.writeUInt32LE(0x1000, 108);
  return Buffer.concat([head, data]);
}
// an uncompressed DDS (32-bit BGRA by masks)
export function ddsRaw(o) {
  const { w, h } = o, head = Buffer.alloc(128), data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = o.px(x, y), i = (y * w + x) * 4; data[i] = v[2]; data[i + 1] = v[1]; data[i + 2] = v[0]; data[i + 3] = v[3]; }
  head.write('DDS ', 0, 'ascii'); head.writeUInt32LE(124, 4); head.writeUInt32LE(0x100f, 8); head.writeUInt32LE(h, 12); head.writeUInt32LE(w, 16); head.writeUInt32LE(w * 4, 20);
  head.writeUInt32LE(32, 76); head.writeUInt32LE(0x41, 80); head.writeUInt32LE(32, 88);
  head.writeUInt32LE(0xff0000, 92); head.writeUInt32LE(0xff00, 96); head.writeUInt32LE(0xff, 100); head.writeUInt32LE(0xff000000, 104); head.writeUInt32LE(0x1000, 108);
  return Buffer.concat([head, data]);
}

// ---- the pictures of the test scene (tools/studio/test/scenes/textures/): file -> { bytes, w, h, px (the pixels it was
// made from, 8-bit RGBA), lossy (BCn: within the block format's error) }
const hi = f => (x, y) => f(x, y).map(v => v >> 8);
export function scenePictures() {
  return {
    'tex/wood.tif': { bytes: tiff({ w: 32, h: 32, spp: 3, bits: 8, photo: 2, comp: 5, pred: 2, le: false, rows: 11, px: PX.wood }), w: 32, h: 32, px: PX.wood },
    'brick.tif': { bytes: tiff({ w: 24, h: 24, spp: 4, bits: 8, photo: 2, comp: 32773, extra: 2, le: true, rows: 8, px: PX.brick }), w: 24, h: 24, px: PX.brick },
    'tex/rough.tif': { bytes: tiff({ w: 16, h: 16, spp: 1, bits: 16, photo: 1, comp: 8, pred: 2, le: true, px: PX.rough }), w: 16, h: 16, px: (x, y) => { const v = PX.rough(x, y)[0] >> 8; return [v, v, v, 255]; } },
    'panel_albedo.psd': { bytes: psd({ w: 32, h: 32, px: PX.panel }), w: 32, h: 32, px: PX.panel, near: 2 },
    'Stone-BaseColor.dds': { bytes: dds({ w: 32, h: 32, kind: 'dxt1', px: PX.stone }), w: 32, h: 32, px: PX.stone, lossy: true },
    'tex/glass.dds': { bytes: dds({ w: 32, h: 32, kind: 'dxt5', px: PX.glass }), w: 32, h: 32, px: PX.glass, lossy: true },
    'panel_nrm.dds': { bytes: dds({ w: 32, h: 32, kind: 'bc5', px: PX.bumps }), w: 32, h: 32, px: PX.bumps, lossy: true },
    'crate_height.png': { bytes: png(16, 16, PX.height), w: 16, h: 16, px: PX.height },
    'paint.png': { bytes: png(16, 16, PX.paint), w: 16, h: 16, px: PX.paint },
    'broken.tif': { bytes: tiffJpeg(), refused: 'a TIFF compressed with JPEG: save it as PNG' },
  };
}
// more, kept in memory only (the Node test): the other kinds each reader takes
export function morePictures() {
  return {
    'pal.tif': { bytes: tiff({ w: 16, h: 16, spp: 1, bits: 8, photo: 3, comp: 1, le: false, cmap: PAL.concat(Array(240).fill([0, 0, 0])), px: PX.pal }), w: 16, h: 16, px: (x, y) => [...PAL[PX.pal(x, y)], 255] },
    'grey-lzw.tif': { bytes: tiff({ w: 40, h: 30, spp: 1, bits: 8, photo: 1, comp: 5, le: true, rows: 7, px: (x, y) => [(x * 7 + y * 3) & 255] }), w: 40, h: 30, px: (x, y) => { const v = (x * 7 + y * 3) & 255; return [v, v, v, 255]; } },
    'big-lzw.tif': { bytes: tiff({ w: 300, h: 40, spp: 3, bits: 8, photo: 2, comp: 5, le: true, px: (x, y) => [(x * 13 + y) & 255, (x ^ y) & 255, (x * y) & 255] }), w: 300, h: 40, px: (x, y) => [(x * 13 + y) & 255, (x ^ y) & 255, (x * y) & 255, 255] },
    'rgb16.tif': { bytes: tiff({ w: 8, h: 8, spp: 3, bits: 16, photo: 2, comp: 32773, le: false, px: (x, y) => [x * 8000, y * 8000, 30000] }), w: 8, h: 8, px: (x, y) => [(x * 8000) >> 8, (y * 8000) >> 8, 30000 >> 8, 255] },
    'raw.psd': { bytes: psd({ w: 12, h: 9, raw: true, alpha: false, px: PX.wood }), w: 12, h: 9, px: (x, y) => [...PX.wood(x, y).slice(0, 3), 255] },
    'grey16.psd': { bytes: psd({ w: 10, h: 10, mode: 1, depth: 16, px: (x, y) => [x * 25] }), w: 10, h: 10, px: (x, y) => [x * 25, x * 25, x * 25, 255] },
    'cmyk.psd': { bytes: psd({ w: 8, h: 8, cmyk: true, px: () => [0, 255, 255, 0] }), w: 8, h: 8, px: () => [255, 0, 0, 255] },
    'raw.dds': { bytes: ddsRaw({ w: 8, h: 6, px: PX.glass }), w: 8, h: 6, px: PX.glass },
    'odd.dds': { bytes: dds({ w: 10, h: 6, kind: 'dxt1', px: PX.stone }), w: 10, h: 6, px: PX.stone, lossy: true },
  };
}
export { grid, hi };

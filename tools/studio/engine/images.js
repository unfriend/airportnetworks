// ================================================================= IMAGES ==
// Pictures and their names (tools/studio/SPEC.md, "Textures: found, added, converted"). Plain JavaScript, no page needed:
// one module in three places, the studio (pasted into stories/studio.js before the converter by
// tools/studio/build.mjs), tools/studio/convert.mjs's headless page and tools/studio/test-images.mjs (Node).
// makeImages(z) gives, z being fflate (unzlibSync, inflateSync; Node's zlib in the test):
//   decodeImage(ext, bytes)  a TIFF, PSD or DDS as { width, height, data: RGBA }, or an Error saying why not in words
//   sniff(bytes), way(ext)   what a picture is by its first bytes, and how it is read ('browser', 'tga', 'decode', 'refuse')
//   texFind(name, pictures, ctx)   the picture a model's texture name stands for: { path, how } or null (the ladder)
//   texRank(name, pictures, ctx, n), slotOf(name, mean), normStem(name)   pictures by likeness, and what a picture is for
//   renamePsd(bytes), psdBack(url)   an FBX's .psd names made .ps~ (its loader never asks for a .psd) and back again
// The browser shows PNG, JPEG, WebP, GIF, BMP and AVIF itself; TGA goes to three.js's TGALoader; TIFF, PSD and DDS are
// read here (the ones textures come in from Photoshop, Substance and game engines); HDR pictures and GPU-compressed
// containers are refused with a sentence.
function makeImages(z) {
  const PIC = { browser: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'], tga: ['tga'], decode: ['tif', 'tiff', 'psd', 'psb', 'dds'], refuse: ['exr', 'hdr', 'heic', 'heif', 'ktx', 'ktx2'] };
  const ALL = [].concat(PIC.browser, PIC.tga, PIC.decode, PIC.refuse);
  // (the order a picture of the same name is taken in, when the one a model names is not there)
  const PREFER = ['png', 'jpg', 'jpeg', 'webp', 'tga', 'bmp', 'tif', 'tiff', 'psd', 'dds'];
  const FMT = { png: 'PNG', jpg: 'JPEG', jpeg: 'JPEG', webp: 'WebP', gif: 'GIF', bmp: 'BMP', avif: 'AVIF', tga: 'TGA', tif: 'TIFF', tiff: 'TIFF', psd: 'PSD (Photoshop)', psb: 'PSB (Photoshop)', dds: 'DDS (DirectX)', exr: 'EXR', hdr: 'HDR', heic: 'HEIC', heif: 'HEIF', ktx: 'KTX', ktx2: 'KTX2' };
  const REFUSE = {
    exr: 'an HDR picture (EXR): save it as PNG or JPEG', hdr: 'an HDR picture (Radiance HDR): save it as PNG or JPEG',
    heic: 'a HEIC photo: save it as JPEG', heif: 'a HEIF photo: save it as JPEG',
    ktx: 'a KTX texture (packed for one kind of GPU): save it as PNG', ktx2: 'a KTX2 texture (packed for one kind of GPU): save it as PNG',
  };
  const extOf = p => (/\.([^./\\?#]+)(?:[?#].*)?$/.exec(String(p)) || ['', ''])[1].toLowerCase();
  const baseOf = p => String(p).split(/[?#]/)[0].split(/[\\/]/).pop();
  const stemOf = p => baseOf(p).replace(/\.[^.]*$/, '');
  const way = ext => { ext = String(ext).toLowerCase(); for (const k in PIC) if (PIC[k].includes(ext)) return k; return ''; };
  const isPicture = p => ALL.includes(extOf(p));
  const u8of = b => (b instanceof Uint8Array ? b : new Uint8Array(b.buffer ? b.buffer : b, b.byteOffset || 0, b.byteLength));
  const fail = s => { throw Object.assign(new Error(s), { said: true }); };
  // (at most 64 million pixels, 8,192 x 8,192: a picture is drawn down to the texture limit after it is read, but read
  // whole first, 4 bytes a pixel)
  const MAX_PX = 1 << 26, tooBig = (w, h, k) => w * h > MAX_PX && fail(`a ${k} too large to read here (more than 64 million pixels): save it smaller`);
  // Deflate unpacked to at most cap bytes (more is left off: a small stream can unpack to gigabytes). fflate's streams,
  // pushed a piece at a time and stopped once past cap; else (Node's zlib in the test) its own functions with the cap
  const STOP = {};
  function unzip(b, cap) {
    if (!z) fail('a compressed picture, and no inflate here');
    const zl = b.length > 1 && (b[0] & 15) === 8 && ((b[0] << 8) | b[1]) % 31 === 0;
    if (!z.Inflate) {
      try { return z.unzlibSync(b, cap).subarray(0, cap); } catch (e) { return z.inflateSync(b, cap).subarray(0, cap); }
    }
    const run = C => {
      const parts = [];
      let n = 0;
      const s = new C(d => { const m = Math.min(d.length, cap - n); if (m > 0) parts.push(d.subarray(0, m)); n += m; if (n >= cap) throw STOP; });
      try { for (let i = 0; i < b.length; i += 32768) s.push(b.subarray(i, i + 32768), i + 32768 >= b.length); } catch (e) { if (e !== STOP) throw e; }
      const o = new Uint8Array(n);
      let p = 0;
      for (const q of parts) { o.set(q, p); p += q.length; }
      return o;
    };
    if (zl && z.Unzlib) { try { return run(z.Unzlib); } catch (e) { /* not zlib after all */ } }
    try { return run(z.Inflate); } catch (e) { fail('a picture whose packed data is damaged'); }
  }

  // ---- what a picture is, by its first bytes ('' unknown: a TGA has no mark)
  function sniff(bytes) {
    const u = u8of(bytes), s = String.fromCharCode.apply(null, u.subarray(0, 16));
    if (u[0] === 0x89 && s.slice(1, 4) === 'PNG') return 'png';
    if (u[0] === 0xff && u[1] === 0xd8) return 'jpg';
    if (s.startsWith('GIF8')) return 'gif';
    if (s.startsWith('RIFF') && s.slice(8, 12) === 'WEBP') return 'webp';
    if (s.startsWith('BM')) return 'bmp';
    if (s.slice(4, 12) === 'ftypavif') return 'avif';
    if (s.slice(4, 12) === 'ftypheic' || s.slice(4, 12) === 'ftypmif1') return 'heic';
    if ((s.startsWith('II') && u[2] === 42) || (s.startsWith('MM') && u[3] === 42) || (s.startsWith('II') && u[2] === 43) || (s.startsWith('MM') && u[3] === 43)) return 'tif';
    if (s.startsWith('8BPS')) return 'psd';
    if (s.startsWith('DDS ')) return 'dds';
    if (u[0] === 0x76 && u[1] === 0x2f && u[2] === 0x31 && u[3] === 0x01) return 'exr';
    if (s.startsWith('#?RADIANCE') || s.startsWith('#?RGBE')) return 'hdr';
    if (s.slice(1, 7) === 'KTX 11') return 'ktx';
    if (s.slice(1, 7) === 'KTX 20') return 'ktx2';
    return '';
  }
  // a picture read here: by its bytes first (a file named wrongly still reads), else by its name
  function decodeImage(ext, bytes) {
    const u = u8of(bytes), k = sniff(u) || String(ext).toLowerCase();
    // (a file cut short or damaged throws the reader's own error, out of range: said in words)
    const safe = (f, n) => { try { return f(u); } catch (e) { if (e && e.said) throw e; fail(`a ${n} cut short or damaged: save it again, or as PNG`); } };
    if (k === 'tif' || k === 'tiff') return safe(tiff, 'TIFF');
    if (k === 'psd' || k === 'psb') return safe(psd, 'PSD');
    if (k === 'dds') return safe(dds, 'DDS');
    if (REFUSE[k]) fail(REFUSE[k]);
    fail(`a ${FMT[k] || (k ? k.toUpperCase() : 'picture')} file this reader does not take (the browser reads PNG, JPEG, WebP, GIF and BMP)`);
  }
  const out = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });

  // ---- PackBits (TIFF and PSD): a count byte, then that many bytes as they are, or one byte repeated
  function packbits(src, n, at, end) {
    const o = new Uint8Array(n);
    let i = at || 0, p = 0;
    end = end === undefined ? src.length : Math.min(end, src.length);   // (a count past the file's end: only what is there)
    while (i < end && p < n) {
      const c = src[i++];
      if (c < 128) { const m = Math.min(c + 1, n - p, end - i); o.set(src.subarray(i, i + m), p); i += c + 1; p += m; }
      else if (c > 128) { const m = Math.min(257 - c, n - p); o.fill(src[i++], p, p + m); p += m; }
    }
    return { o, i };
  }
  // ---- TIFF's LZW: codes of 9 to 12 bits, first bit first, 256 clears and 257 ends, one bit wider a code early
  function lzw(src, n) {
    const o = new Uint8Array(n), pre = new Int32Array(4096), suf = new Uint8Array(4096), len = new Uint16Array(4096);
    for (let i = 0; i < 256; i++) { pre[i] = -1; suf[i] = i; len[i] = 1; }
    let next = 258, bits = 9, old = -1, pos = 0, p = 0;
    const total = src.length * 8;
    const put = c => { const L = len[c]; let q = c; for (let k = L - 1; k >= 0; k--) { if (p + k < n) o[p + k] = suf[q]; q = pre[q]; } p = Math.min(n, p + L); };
    const first = c => { while (pre[c] >= 0) c = pre[c]; return suf[c]; };
    while (pos + bits <= total && p < n) {
      const b = pos >> 3, v = ((src[b] << 16) | ((src[b + 1] || 0) << 8) | (src[b + 2] || 0)) >>> (24 - bits - (pos & 7)) & ((1 << bits) - 1);
      pos += bits;
      if (v === 257) break;
      if (v === 256) { next = 258; bits = 9; old = -1; continue; }
      if (old < 0) { if (v > 255) break; put(v); old = v; }
      else {
        if (v < next) { put(v); if (next < 4096) { pre[next] = old; suf[next] = first(v); len[next] = len[old] + 1; next++; } }
        else if (v === next && next < 4096) { pre[next] = old; suf[next] = first(old); len[next] = len[old] + 1; next++; put(v); }
        else break;
        old = v;
      }
      if (next + 1 >= (1 << bits) && bits < 12) bits++;
    }
    return o;
  }

  // ---- TIFF: baseline, in strips or tiles; none, LZW, PackBits or Deflate, the horizontal predictor; 1 to 16 bits;
  // grey, RGB, palette and CMYK, with or without alpha; either byte order
  const TIFF_COMP = { 2: 'CCITT', 3: 'CCITT fax', 4: 'CCITT fax', 6: 'JPEG', 7: 'JPEG', 34661: 'JBIG', 34712: 'JPEG 2000', 34887: 'LERC', 34925: 'LZMA', 50000: 'Zstandard', 50001: 'WebP', 50002: 'JPEG XL' };
  function tiff(u) {
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength), le = u[0] === 0x49;
    const r16 = o => dv.getUint16(o, le), r32 = o => dv.getUint32(o, le);
    if (r16(2) === 43) fail('a BigTIFF (over 4 GB in form): save it as PNG');
    if (r16(2) !== 42) fail('not a TIFF file');
    const SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };
    const ifd = r32(4), cnt = r16(ifd), T = {};
    for (let i = 0; i < cnt; i++) {
      const e = ifd + 2 + i * 12, tag = r16(e), type = r16(e + 2), n = r32(e + 4), sz = (SIZE[type] || 1) * n;
      const at = sz <= 4 ? e + 8 : r32(e + 8);
      if (at + sz > u.length || n > 1 << 24) continue;
      const v = [];
      for (let k = 0; k < n; k++) v.push(type === 3 ? r16(at + k * 2) : type === 4 ? r32(at + k * 4) : type === 8 ? dv.getInt16(at + k * 2, le) : type === 9 ? dv.getInt32(at + k * 4, le) : u[at + k]);
      T[tag] = v;
    }
    const one = (t, d) => (T[t] ? T[t][0] : d);
    const W = one(256, 0), H = one(257, 0), comp = one(259, 1), photo = one(262, 1), spp = one(277, 1), planar = one(284, 1), pred = one(317, 1), sfmt = one(339, 1);
    const bps = T[258] || [1], bits = bps[0];
    if (!W || !H) fail('a TIFF without its size');
    tooBig(W, H, 'TIFF');
    if (spp < 1 || spp > 16) fail(`a TIFF of ${spp} samples a pixel: save it as PNG`);
    if (![1, 5, 8, 32773, 32946].includes(comp)) fail(`a TIFF compressed with ${TIFF_COMP[comp] || 'scheme ' + comp}: save it as PNG`);
    if (sfmt === 3) fail('a TIFF of floating-point numbers (an HDR picture): save it as PNG or JPEG');
    if (bps.some(b => b !== bits) || ![1, 2, 4, 8, 16].includes(bits) || (spp > 1 && bits < 8)) fail(`a TIFF of ${bps.join(', ')} bits a sample: save it as PNG`);
    if (![0, 1, 2, 3, 5].includes(photo)) fail(photo === 6 ? 'a TIFF in YCbCr: save it as PNG' : `a TIFF in colour model ${photo}: save it as PNG`);
    if (photo === 3 && (!T[320] || bits > 8)) fail('a palette TIFF without its palette: save it as PNG');
    if (photo === 5 && spp < 4) fail('a CMYK TIFF without four inks: save it as PNG');
    if (pred !== 1 && pred !== 2) fail('a TIFF with a floating-point predictor: save it as PNG');
    if (pred === 2 && bits < 8) fail(`a TIFF of ${bits} bits a sample with a predictor: save it as PNG`);
    const tiled = !!T[324], cw = tiled ? one(322, 0) : W, ch = tiled ? one(323, 0) : Math.min(one(278, H) || H, H);
    const offs = tiled ? T[324] : T[273], lens = tiled ? T[325] : T[279];
    if (!offs) fail('a TIFF without its picture data');
    // (tiles or strips of no size would never end; tiles far bigger than the picture would ask for memory it never fills)
    if (cw < 1 || ch < 1 || (tiled && (cw > W + 1024 || ch > H + 1024))) fail('a TIFF whose strips or tiles have no proper size: save it again, or as PNG');
    const across = tiled ? Math.ceil(W / cw) : 1, down = Math.ceil(H / ch), per = across * down, planes = planar === 2 ? spp : 1;
    if (per * planes > offs.length || per > 1 << 20) fail('a TIFF missing some of its strips or tiles: save it again, or as PNG');
    const sp = planar === 2 ? 1 : spp, rowB = Math.ceil((cw * sp * bits) / 8), want = rowB * ch;
    // the data there before any memory is asked for: each piece's bytes in the file, and enough of them for the picture
    // at the most any compression here packs (none 1:1, PackBits 128, Deflate about 1,032, LZW about 2,730)
    let have = 0;
    for (let i = 0; i < per * planes; i++) { const at = offs[i], len = lens ? lens[i] : u.length - at; if (at >= u.length) continue; have += Math.min(len, u.length - at); }
    const RATIO = { 1: 1, 32773: 128, 8: 1100, 32946: 1100, 5: 2800 };
    if (have * RATIO[comp] < (W * H * spp * bits) / 8 * (comp === 1 ? 1 : 0.9)) fail('a TIFF cut short: save it again, or as PNG');
    if (comp === 5 && offs.some((at, i) => i < per * planes && u[at] === 0 && u[at + 1] & 1)) fail('a TIFF in the old LZW of the 1980s: save it as PNG');
    const S = new Uint8Array(W * H * spp), max = (1 << bits) - 1;
    for (let plane = 0; plane < planes; plane++) {
      for (let c = 0; c < per; c++) {
        const idx = plane * per + c, at = offs[idx];
        if (at === undefined || at >= u.length) continue;
        const len = lens ? lens[idx] : u.length - at;
        const raw = u.subarray(at, Math.min(u.length, at + len));
        let b = comp === 1 ? raw : comp === 5 ? lzw(raw, want) : comp === 32773 ? packbits(raw, want).o : unzip(raw, want);
        if (pred === 2) {   // (each sample the difference from the one before it in the row)
          b = new Uint8Array(b);
          for (let y = 0; y < ch; y++) {
            const r0 = y * rowB;
            if (bits === 8) for (let i = sp; i < cw * sp; i++) b[r0 + i] = (b[r0 + i] + b[r0 + i - sp]) & 255;
            else if (bits === 16) for (let i = sp; i < cw * sp; i++) {
              const a = r0 + i * 2, q = r0 + (i - sp) * 2, va = le ? b[a] | (b[a + 1] << 8) : (b[a] << 8) | b[a + 1], vq = le ? b[q] | (b[q + 1] << 8) : (b[q] << 8) | b[q + 1], v = (va + vq) & 65535;
              if (le) { b[a] = v & 255; b[a + 1] = v >> 8; } else { b[a] = v >> 8; b[a + 1] = v & 255; }
            }
          }
        }
        const x0 = (c % across) * cw, y0 = Math.floor(c / across) * ch;
        for (let y = 0; y < ch && y0 + y < H; y++) for (let x = 0; x < cw && x0 + x < W; x++) for (let s = 0; s < sp; s++) {
          const k = x * sp + s, r0 = y * rowB;
          let v;
          if (bits === 8) v = b[r0 + k];
          else if (bits === 16) { const a = r0 + k * 2; v = (le ? b[a + 1] : b[a]) | 0; }   // (the high byte)
          else { const bit = k * bits; v = (b[r0 + (bit >> 3)] >> (8 - bits - (bit & 7))) & max; if (photo !== 3) v = Math.round((v * 255) / max); }
          S[((y0 + y) * W + x0 + x) * spp + (planar === 2 ? plane : s)] = v === undefined ? 0 : v;
        }
      }
    }
    const R = out(W, H), d = R.data, extra = T[338] || [], cm = T[320], pn = 1 << bits;
    const alphaAt = photo === 2 ? 3 : photo === 5 ? 4 : 1, hasA = spp > alphaAt, assoc = extra[0] === 1;
    for (let i = 0, j = 0; i < W * H; i++, j += spp) {
      let r, g, bl;
      if (photo === 2) { r = S[j]; g = S[j + 1]; bl = S[j + 2]; }
      else if (photo === 3) { const x = S[j]; r = cm[x] >> 8; g = cm[pn + x] >> 8; bl = cm[2 * pn + x] >> 8; }
      else if (photo === 5) { const k = 255 - S[j + 3]; r = ((255 - S[j]) * k) / 255; g = ((255 - S[j + 1]) * k) / 255; bl = ((255 - S[j + 2]) * k) / 255; }
      else { r = g = bl = photo === 0 ? 255 - S[j] : S[j]; }
      let a = hasA ? S[j + alphaAt] : 255;
      if (hasA && assoc && a > 0 && a < 255) { r = (r * 255) / a; g = (g * 255) / a; bl = (bl * 255) / a; }   // (premultiplied: undone)
      d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = bl; d[i * 4 + 3] = a;
    }
    return R;
  }

  // ---- PSD (and PSB): the merged picture Photoshop keeps after the layers, raw, RLE or zipped; 1, 8 or 16 bits; grey,
  // RGB, CMYK, palette, bitmap and duotone; alpha from the channel after the colours, when the file says it is the
  // merged picture's transparency
  function psd(u) {
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength), ver = dv.getUint16(4);
    if (ver !== 1 && ver !== 2) fail('not a PSD file');
    const big = ver === 2, nch = dv.getUint16(12), H = dv.getUint32(14), W = dv.getUint32(18), depth = dv.getUint16(22), mode = dv.getUint16(24);
    if (!W || !H) fail('a PSD without its size');
    tooBig(W, H, 'PSD');
    if (depth === 32) fail('a 32-bit PSD (an HDR picture): save it as 8 or 16 bits, or as PNG');
    if (![1, 8, 16].includes(depth)) fail(`a PSD of ${depth} bits a channel: save it as PNG`);
    if (![0, 1, 2, 3, 4, 8].includes(mode)) fail(mode === 9 ? 'a PSD in Lab colour: save it as RGB, or as PNG' : 'a PSD in multichannel mode: save it as RGB, or as PNG');
    const need = mode === 3 || mode === 4 ? (mode === 3 ? 3 : 4) : 1;
    if (nch < need) fail('a PSD with fewer channels than its colours need: save it again, or as PNG');
    let o = 26;
    const cmLen = dv.getUint32(o), cmAt = o + 4;
    o += 4 + cmLen;
    // image resources: alpha channels named or numbered (1006, 1045, 1053) are channels of their own, saved selections
    // and masks, not transparency
    const resLen = dv.getUint32(o), resEnd = o + 4 + resLen;
    let named = false;
    for (let r = o + 4; r + 12 <= Math.min(resEnd, u.length);) {
      if (dv.getUint32(r) !== 0x3842494d) break;   // ('8BIM')
      const id = dv.getUint16(r + 4), nl = u[r + 6], p = r + 6 + (((nl + 2) >> 1) << 1), len = dv.getUint32(p);
      if (id === 1006 || id === 1045 || id === 1053) named = true;
      r = p + 4 + len + (len & 1);
    }
    o = resEnd;
    // layers and masks: a layer count below 0 says the first alpha channel holds the merged picture's transparency
    const lmLen = big ? Number(dv.getBigUint64(o)) : dv.getUint32(o), lmAt = o + (big ? 8 : 4);
    const liLen = lmLen ? (big ? Number(dv.getBigUint64(lmAt)) : dv.getUint32(lmAt)) : 0, layers = liLen >= 2 ? dv.getInt16(lmAt + (big ? 8 : 4)) : 0;
    o = lmAt + lmLen;
    // (with layers, only a negative count; without any, a fourth channel nothing names is the transparency, as an RGBA
    // picture saved by most programs has it)
    const clear = layers < 0 || (layers === 0 && !named);
    if (o + 2 > u.length) fail('a PSD cut short');
    const comp = dv.getUint16(o);
    o += 2;
    const rowB = Math.ceil((W * depth) / 8), use = Math.min(nch, need + (clear && mode !== 2 ? 1 : 0));
    // the data there before any memory is asked for (RLE packs at most 128 to 1, zip about 1,032)
    const left = u.length - o;
    if ((comp === 0 && left < use * rowB * H) || (comp === 1 && left < nch * H * (big ? 4 : 2)) || (comp === 2 && left * 1100 < use * rowB * H)) fail('a PSD cut short');
    const ch = [];   // each channel's rows as 8-bit samples
    const take = (raw, c) => {
      const q = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const r0 = y * rowB;
        q[y * W + x] = depth === 8 ? raw[r0 + x] : depth === 16 ? raw[r0 + x * 2] : (raw[r0 + (x >> 3)] >> (7 - (x & 7))) & 1 ? 0 : 255;
      }
      ch[c] = q;
    };
    if (comp === 0) for (let c = 0; c < use; c++) take(u.subarray(o + c * rowB * H), c);
    else if (comp === 1) {
      const cb = big ? 4 : 2, counts = o;
      let at = o + nch * H * cb;
      for (let c = 0; c < use; c++) {   // (the channels after those used are not read at all)
        let sum = 0;
        for (let y = 0; y < H; y++) sum += big ? dv.getUint32(counts + (c * H + y) * 4) : dv.getUint16(counts + (c * H + y) * 2);
        if (at + sum > u.length || sum * 128 < rowB * H) fail('a PSD cut short');
        const raw = new Uint8Array(rowB * H);
        for (let y = 0; y < H; y++) {
          const k = c * H + y, n = big ? dv.getUint32(counts + k * 4) : dv.getUint16(counts + k * 2);
          raw.set(packbits(u, rowB, at, at + n).o, y * rowB);
          at += n;
        }
        take(raw, c);
      }
    } else if (comp === 2) {
      const raw = unzip(u.subarray(o), use * rowB * H);
      for (let c = 0; c < use; c++) take(raw.subarray(c * rowB * H), c);
    } else fail('a PSD zipped with prediction: save it as PNG');
    const R = out(W, H), d = R.data, pal = mode === 2 ? u.subarray(cmAt, cmAt + 768) : null;
    let any = false;
    for (let i = 0; i < W * H; i++) {
      let r, g, b, a = 255;
      if (mode === 3) { r = ch[0][i]; g = ch[1][i]; b = ch[2][i]; if (ch[3]) a = ch[3][i]; }   // (ch[need] only when it is transparency)
      else if (mode === 4) { const k = ch[3][i]; r = (ch[0][i] * k) / 255; g = (ch[1][i] * k) / 255; b = (ch[2][i] * k) / 255; if (ch[4]) a = ch[4][i]; }   // (inks stored as 255 less the ink)
      else if (mode === 2) { const x = ch[0][i]; r = pal[x]; g = pal[256 + x]; b = pal[512 + x]; }
      else { r = g = b = ch[0][i]; if (ch[1] && mode !== 0) a = ch[1][i]; }
      // (Photoshop keeps the merged colours of a see-through document blended over white: taken off again, as
      // ImageMagick's reader does)
      if (a > 0 && a < 255 && mode !== 2) { const k = 255 / a, wh = 255 - a; r = (r - wh) * k; g = (g - wh) * k; b = (b - wh) * k; }
      d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = a;
      if (r > 0 || g > 0 || b > 0 || a) any = true;
    }
    if (!any) fail('a PSD whose merged picture is empty: save it with Maximise compatibility on, or as PNG');
    return R;
  }

  // ---- DDS: its largest picture only; uncompressed by its masks, DXT1/BC1, DXT3/BC2, DXT5/BC3, BC4 (ATI1), BC5 (ATI2, a
  // normal map's x and y: its z rebuilt), also under the DX10 header
  const DXGI = { 28: 'rgba', 29: 'rgba', 87: 'bgra', 91: 'bgra', 88: 'bgrx', 93: 'bgrx', 71: 'bc1', 72: 'bc1', 74: 'bc2', 75: 'bc2', 77: 'bc3', 78: 'bc3', 80: 'bc4', 81: 'bc4s', 83: 'bc5', 84: 'bc5s' };
  const DXGI_NAME = { 94: 'BC6H (HDR)', 95: 'BC6H (HDR)', 96: 'BC6H (HDR)', 97: 'BC7', 98: 'BC7', 99: 'BC7', 2: '32-bit floats (HDR)', 10: '16-bit floats (HDR)' };
  function dds(u) {
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength), r32 = o => dv.getUint32(o, true);
    if (u.length < 128 || r32(4) !== 124) fail('not a DDS file');
    const H = r32(12), W = r32(16), pf = 76, flags = r32(pf + 4), cc = String.fromCharCode(u[pf + 8], u[pf + 9], u[pf + 10], u[pf + 11]);
    if (!W || !H) fail('a DDS without its size');
    tooBig(W, H, 'DDS');
    let kind = '', at = 128;
    if (flags & 4) {
      if (cc === 'DX10') { if (u.length < 148) fail('a DDS cut short'); const f = r32(128); at = 148; kind = DXGI[f] || fail(`a DDS of ${DXGI_NAME[f] || 'DXGI format ' + f}: save it as PNG`); }
      else kind = { DXT1: 'bc1', DXT2: 'bc2', DXT3: 'bc2', DXT4: 'bc3', DXT5: 'bc3', ATI1: 'bc4', BC4U: 'bc4', BC4S: 'bc4s', ATI2: 'bc5', BC5U: 'bc5', BC5S: 'bc5s' }[cc] || fail(`a DDS packed as ${cc.replace(/\0/g, '').trim() || 'an unknown kind'}: save it as PNG`);
    }
    // (the data there before the picture's memory is asked for)
    const bsz = kind === 'bc1' || kind === 'bc4' || kind === 'bc4s' ? 8 : 16, bw = Math.ceil(W / 4), bh = Math.ceil(H / 4);
    if (!kind || ['rgba', 'bgra', 'bgrx'].includes(kind)) {
      // uncompressed: each colour by its mask (or the DX10 format's own order)
      const bpp = kind ? 32 : r32(pf + 12), M = kind === 'rgba' ? [0xff, 0xff00, 0xff0000, 0xff000000] : kind ? [0xff0000, 0xff00, 0xff, kind === 'bgra' ? 0xff000000 : 0] : [r32(pf + 16), r32(pf + 20), r32(pf + 24), flags & 3 ? r32(pf + 28) : 0];
      const lum = !kind && flags & 0x20000, by = bpp >> 3;
      if (![8, 16, 24, 32].includes(bpp)) fail(`a DDS of ${bpp} bits a pixel: save it as PNG`);
      const ch = M.map(m => { if (!m) return null; let s = 0; while (!((m >>> s) & 1)) s++; let n = 0; while ((m >>> (s + n)) & 1) n++; return { m, s, k: 255 / ((2 ** n) - 1) }; });
      if (at + W * H * by > u.length) fail('a DDS cut short');
      const R = out(W, H), d = R.data;
      for (let i = 0; i < W * H; i++) {
        const p = at + i * by;
        let v = 0;
        for (let k = 0; k < by; k++) v += u[p + k] * 2 ** (8 * k);
        const g = c => (c ? Math.round((((v & c.m) >>> 0) / 2 ** c.s) * c.k) : 255);
        const r = g(ch[0]);
        d[i * 4] = r; d[i * 4 + 1] = lum ? r : g(ch[1]); d[i * 4 + 2] = lum ? r : g(ch[2]); d[i * 4 + 3] = g(ch[3]);
      }
      return R;
    }
    if (at + bw * bh * bsz > u.length) fail('a DDS cut short');
    const R = out(W, H), d = R.data;
    // (clamped arrays round the steps between the ends, as reference decoders do, where plain ones would floor them)
    const pal = new Uint8ClampedArray(16), al = new Uint8ClampedArray(8), A = new Uint8Array(16), B = new Uint8Array(16);
    const c565 = (v, o) => { pal[o] = ((v >> 11) & 31) * 255 / 31; pal[o + 1] = ((v >> 5) & 63) * 255 / 63; pal[o + 2] = (v & 31) * 255 / 31; pal[o + 3] = 255; };
    // a BC4 block (8 bytes) as 16 values: two ends, then six or four steps between them (and 0 and 255)
    const bc4 = (p, sg, q) => {
      let a0 = u[p], a1 = u[p + 1];
      if (sg) { a0 = ((a0 << 24) >> 24) + 128; a1 = ((a1 << 24) >> 24) + 128; }
      al[0] = a0; al[1] = a1;
      if (a0 > a1) for (let k = 1; k < 7; k++) al[k + 1] = ((7 - k) * a0 + k * a1) / 7;
      else { for (let k = 1; k < 5; k++) al[k + 1] = ((5 - k) * a0 + k * a1) / 5; al[6] = 0; al[7] = 255; }
      const lo = u[p + 2] | (u[p + 3] << 8) | (u[p + 4] << 16), hi = u[p + 5] | (u[p + 6] << 8) | (u[p + 7] << 16);
      for (let k = 0; k < 16; k++) q[k] = al[k < 8 ? (lo >> (3 * k)) & 7 : (hi >> (3 * (k - 8))) & 7];
    };
    for (let by2 = 0; by2 < bh; by2++) for (let bx = 0; bx < bw; bx++) {
      const p = at + (by2 * bw + bx) * bsz;
      let colour = -1;
      if (kind === 'bc1') colour = p;
      else if (kind === 'bc2') { for (let k = 0; k < 16; k++) { const v = (u[p + (k >> 1)] >> ((k & 1) * 4)) & 15; A[k] = v * 17; } colour = p + 8; }
      else if (kind === 'bc3') { bc4(p, false, A); colour = p + 8; }
      else if (kind === 'bc4' || kind === 'bc4s') bc4(p, kind === 'bc4s', A);
      else { bc4(p, kind === 'bc5s', A); bc4(p + 8, kind === 'bc5s', B); }
      if (colour >= 0) {
        const c0 = u[colour] | (u[colour + 1] << 8), c1 = u[colour + 2] | (u[colour + 3] << 8);
        c565(c0, 0); c565(c1, 4);
        const four = c0 > c1 || kind !== 'bc1';
        for (let j = 0; j < 3; j++) {
          pal[8 + j] = four ? (2 * pal[j] + pal[4 + j]) / 3 : (pal[j] + pal[4 + j]) / 2;
          pal[12 + j] = four ? (pal[j] + 2 * pal[4 + j]) / 3 : 0;
        }
        pal[11] = 255; pal[15] = four ? 255 : 0;
      }
      for (let k = 0; k < 16; k++) {
        const x = bx * 4 + (k & 3), y = by2 * 4 + (k >> 2);
        if (x >= W || y >= H) continue;
        const i = (y * W + x) * 4;
        if (colour >= 0) {
          const s = ((u[colour + 4 + (k >> 2)] >> ((k & 3) * 2)) & 3) * 4;
          d[i] = pal[s]; d[i + 1] = pal[s + 1]; d[i + 2] = pal[s + 2]; d[i + 3] = kind === 'bc1' ? pal[s + 3] : A[k];
        } else if (kind === 'bc4' || kind === 'bc4s') { d[i] = d[i + 1] = d[i + 2] = A[k]; d[i + 3] = 255; }
        else {
          const nx = A[k] / 127.5 - 1, ny = B[k] / 127.5 - 1, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
          d[i] = A[k]; d[i + 1] = B[k]; d[i + 2] = Math.round((nz * 0.5 + 0.5) * 255); d[i + 3] = 255;
        }
      }
    }
    return R;
  }

  // ---- names: what a texture name stands for in a scene (the ladder), and what a picture is for
  // (words taken apart at separators and at a capital after a small letter: Stone-BaseColor, stoneBaseColor and
  // stone_base_color all read stone, basecolor)
  const COLOUR = new Set(['diffuse', 'diff', 'albedo', 'basecolor', 'basecolour', 'color', 'colour', 'col', 'd', 'tex', 'texture']);
  const SLOT_WORDS = [['orm', ['orm']], ['normalMap', ['normal', 'normals', 'nrm', 'norm', 'nor', 'nml', 'n']], ['roughnessMap', ['rough', 'roughness', 'rgh', 'r']],
    ['metalnessMap', ['metal', 'metallic', 'metalness', 'mtl', 'm']], ['aoMap', ['ao', 'occlusion', 'ambientocclusion', 'occ']], ['emissiveMap', ['emissive', 'emission', 'glow', 'emit', 'e']], ['alphaMap', ['opacity', 'alpha', 'mask', 'transparency']]];
  // (words that say a picture is a colour one: they win over a slot word elsewhere in the name, Metal_Door_Albedo)
  const COLOUR_SAYS = new Set(['diffuse', 'diff', 'albedo', 'basecolor', 'basecolour', 'color', 'colour', 'col']);
  // (words after the slot that say nothing of it: a size, a number, a normal map's handedness, 'map')
  const TAIL = /^(\d+k?|gl|dx|ogl|opengl|directx|v\d+|map|tex|texture|img)$/;
  const words = p => stemOf(p).replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().replace(/base[\s_.-]*colou?r/g, ' basecolor ').replace(/ambient[\s_.-]*occlusion/g, ' ao ').split(/[^a-z0-9]+/).filter(Boolean);
  // (a one-letter word names a slot only last, after another: wood_n is a normal map, n.png is not)
  const slotWord = (w, i, all) => w.length > 1 || (i === all.length - 1 && all.length > 1);
  const normStem = p => { const w = words(p); return w.filter((x, i) => !(COLOUR.has(x) && slotWord(x, i, w))).join(' '); };
  const isNormalColour = m => !!m && m[2] > 0.75 && Math.abs(m[0] - 0.5) < 0.1 && Math.abs(m[1] - 0.5) < 0.1;
  // a picture's slot by the words of its name ('map' when none says): mean, its mean colour (0 to 1), when known, tells a
  // normal map by its bluish purple
  // Only the last word names a slot, sizes and numbers after it aside (Rough_Stone.png is a stone, stone_rough.png its
  // roughness, stone_rough_2k.png too), and a colour word anywhere makes it a colour picture (Metal_Door_Albedo.jpg)
  function slotOf(p, mean) {
    const w = words(p);
    while (w.length > 1 && TAIL.test(w[w.length - 1])) w.pop();
    if (w.some((x, i) => COLOUR_SAYS.has(x) || (x === 'd' && i === w.length - 1 && i > 0))) return 'map';
    const i = w.length - 1;
    if (i >= 0) for (const [slot, list] of SLOT_WORDS) if (list.includes(w[i]) && slotWord(w[i], i, w)) return slot;
    return isNormalColour(mean) ? 'normalMap' : 'map';
  }
  const dirOf = p => (p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '');
  // a relative path from a folder ('..' and '.' worked out; null when it leaves the scene)
  function join(dir, rel) {
    const out = [];
    for (const s of (dir + rel).split('/')) { if (s === '' || s === '.') continue; if (s === '..') { if (!out.length) return null; out.pop(); } else out.push(s); }
    return out.join('/');
  }
  // the nearest of several: in the model's own folder first, then the one sharing most of its path, then the shortest
  const near = (list, dir) => list.slice().sort((a, b) => {
    const sa = dirOf(a) === dir ? 1 : 0, sb = dirOf(b) === dir ? 1 : 0;
    if (sa !== sb) return sb - sa;
    const ca = common(a, dir), cb = common(b, dir);
    return cb - ca || a.length - b.length || (a < b ? -1 : 1);
  });
  const common = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
  // The ladder: 'path' the path it gives (from the model's folder, else the scene's top), 'name' its file name in any
  // case (the nearest), 'ext' its name with another picture's extension (x.tga for x.png: PNG first, then JPEG...), and
  // 'similar' the same words but colour words (diffuse, albedo, basecolor...) and in the same slot, only when exactly
  // one picture is so. pictures: the scene's picture paths; ctx: { dir: the model's folder }
  function texFind(name, pictures, ctx) {
    const dir = (ctx && ctx.dir) || '';
    let rel = String(name).split(/[?#]/)[0].replace(/\\/g, '/');
    try { rel = decodeURIComponent(rel); } catch (e) { /* as it is */ }
    rel = rel.replace(/^(\.\/)+/, '');
    const L = pictures.filter(p => isPicture(p)), set = new Set(L);
    if (!/^[a-z][a-z0-9+.-]*:/i.test(rel) && !rel.startsWith('/')) {
      for (const p of [join(dir, rel), join('', rel)]) if (p && set.has(p)) return { path: p, how: 'path' };
    }
    const b = baseOf(rel).toLowerCase();
    if (!b) return null;
    let c = L.filter(p => baseOf(p).toLowerCase() === b);
    if (c.length) return { path: near(c, dir)[0], how: 'name' };
    const st = stemOf(b), e0 = extOf(b);
    c = L.filter(p => stemOf(p).toLowerCase() === st && extOf(p) !== e0 && PREFER.includes(extOf(p)));
    // (the model's own folder first, as for 'name'; then PNG before JPEG...)
    if (c.length) { const r = PREFER.indexOf.bind(PREFER), own = q => (dirOf(q) === dir ? 0 : 1); return { path: c.sort((x, y) => own(x) - own(y) || r(extOf(x)) - r(extOf(y)) || (near([x, y], dir)[0] === x ? -1 : 1))[0], how: 'ext' }; }
    const ns = normStem(rel), slot = slotOf(rel);
    if (!ns) return null;
    c = L.filter(p => PREFER.includes(extOf(p)) && normStem(p) === ns && slotOf(p) === slot);
    const stems = new Set(c.map(p => dirOf(p) + stemOf(p).toLowerCase()));
    if (stems.size === 1) { const r = PREFER.indexOf.bind(PREFER); return { path: c.sort((x, y) => r(extOf(x)) - r(extOf(y)))[0], how: 'similar' }; }
    return null;
  }
  // pictures by how likely they stand for a name: the ladder's rungs first, then shared words (colour words aside), the
  // same slot and the model's folder, and ones no other model uses (ctx.used); at most n, best first (refused formats and
  // ctx.not left out)
  function texRank(name, pictures, ctx, n) {
    const dir = (ctx && ctx.dir) || '', used = new Set((ctx && ctx.used) || []), hit = texFind(name, pictures, ctx), wn = new Set(normStem(name).split(' ').filter(Boolean)), slot = slotOf(name);
    const score = p => {
      if (hit && p === hit.path) return 1000;
      const wp = new Set(normStem(p).split(' ').filter(Boolean));
      let both = 0;
      for (const x of wn) if (wp.has(x)) both++;
      const jac = wn.size + wp.size ? both / (wn.size + wp.size - both) : 0;
      return jac * 60 + (slotOf(p) === slot ? 10 : 0) + (dirOf(p) === dir ? 5 : 0) + (stemOf(p).toLowerCase() === stemOf(name).toLowerCase() ? 100 : 0) - (used.has(p) ? 20 : 0);
    };
    const L = pictures.filter(p => isPicture(p) && way(extOf(p)) !== 'refuse' && !(ctx && ctx.not && ctx.not.includes(p)));
    return L.map(p => [p, score(p)]).sort((a, b) => b[1] - a[1] || (near([a[0], b[0]], dir)[0] === a[0] ? -1 : 1)).slice(0, n || 3).map(x => x[0]);
  }

  // ---- an FBX's .psd names: three.js's FBXLoader makes an empty texture for any name ending in .psd without asking for
  // it, so each is made .ps~ (the same length: nothing else in the file moves) and the URL modifier makes it .psd again.
  // Binary: only a string record ('S', its length, the string) that ends right there; ASCII: a quoted string. A copy
  function renamePsd(bytes) {
    const u = new Uint8Array(u8of(bytes)), n = u.length;
    let s = '', count = 0;
    for (let i = 0; i < n; i += 65536) s += String.fromCharCode.apply(null, u.subarray(i, Math.min(n, i + 65536)));
    const bin = s.startsWith('Kaydara FBX Binary'), dv = new DataView(u.buffer);
    const re = bin ? /\.psd/gi : /\.psd"/gi;
    let m;
    while ((m = re.exec(s))) {
      const end = m.index + 4;
      if (bin) {
        let ok = false;
        for (let p = m.index - 1; p >= Math.max(0, m.index - 2048) && !ok; p--) if (u[p] === 0x53 && p + 5 <= n && dv.getUint32(p + 1, true) === end - (p + 5)) ok = true;
        if (!ok) continue;
      }
      u[m.index + 3] = 0x7e;   // ('~')
      count++;
    }
    return { bytes: u.buffer, count };
  }
  const psdBack = url => String(url).replace(/\.(p)(s)(~|%7e)(?=$|[?#])/i, (m, p, q) => '.' + p + q + (q === 'S' ? 'D' : 'd'));   // (in the name's own case)

  return { decodeImage, sniff, way, isPicture, extOf, baseOf, stemOf, FMT, REFUSE, PREFER, ALL, texFind, texRank, slotOf, normStem, words, isNormalColour, renamePsd, psdBack, join, lzw, packbits };
}

// ================================================================ CONVERT ==
// The converter (tools/studio/SPEC.md, "GLB first, and converting"): one module in two places, the studio's page (its
// Convert to GLB and the Upload pane; pasted into stories/studio.js by tools/studio/build.mjs) and
// tools/studio/convert.mjs (in its headless page). Nothing in it knows where files come from: the caller says how a name
// a model gives becomes an address (url). makeConverter(THREE, hooks) gives:
//   fbxGuess(buf)       an FBX's units and up axis, read from its bytes (three.js's loader ignores them)
//   guessFor(g, size)   the scale and turn a model starts with (the studio's guess; a GLB has it baked in)
//   namesIn(ext, buf), mtlNames(text)   the files a model names (textures, an OBJ's MTL, a glTF's buffers), unloaded
//   load(o)             a model read: FBX, glTF/GLB, OBJ (with its MTL), PLY, STL -> { root, clips, guess, asset, missing,
//                       why, decoded }; the TIFF, PSD and DDS pictures it names read first (engine/images.js) and given
//                       to its loader as PNG, a TGA name read whatever the file is
//   texFind, texRank, slotOf, normStem   which picture a texture name stands for (engine/images.js: the ladder)
//   picture(url, o), matsOf(root), addTextures(root, list, o)   a picture to lay on, the materials, pictures laid on
//   reduce(root, keep)  fewer triangles: every mesh down to that share (meshoptimizer's simplifier), a new geometry each
//   fillModel(root, o)  the gaps between its pictures' pieces filled from the colours round them (engine/images.js's cover
//                       and fillGaps), so a lighter model samples no black between them; o.copy: new canvases, the model's
//                       own pictures left as they are (the studio's preview)
//   triCount(ext, buf)  how many triangles a model file holds, read cheaply from its bytes (null: cannot be told)
//   toGLB(m, o)         a loaded model as one binary glTF in metres and Y up (its pictures' gaps filled unless o.fill is
//                       false; o.keep: made lighter first), loaded back and checked against it
//   glbJSON(buf), glbPatch(buf, fn), glbRecord(json)   a GLB's JSON chunk, changed, and its asset.extras.studio
// hooks.exporter(): defines THREE.GLTFExporter (the studio does so only when converting); hooks.simplifier(): meshoptimizer's
// simplifier (the studio makes it only when first asked; convert.mjs's page has MeshoptSimplifier); hooks.renderer(w, h): a WebGL
// renderer for drawing both to compare their looks (convert.mjs only: the app's one renderer is the shell's)
function makeConverter(THREE, hooks) {
  const T = THREE, H = hooks || {};
  const AX = new T.Vector3(1, 0, 0), AZ = new T.Vector3(0, 0, 1);
  const yieldNow = () => new Promise(r => setTimeout(r, 0));
  const baseOf = p => String(p).split(/[?#]/)[0].split(/[\\/]/).pop();
  const MODEL_EXT = ['fbx', 'glb', 'gltf', 'obj', 'ply', 'stl'];
  const TEX_KEYS = ['map', 'normalMap', 'emissiveMap', 'aoMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'specularMap', 'bumpMap', 'lightMap'];
  // pictures and their names (engine/images.js; fflate unpacks a zipped TIFF or PSD: the studio's own copy, or the page's)
  const IM = H.images || makeImages(typeof fflate !== 'undefined' ? fflate : null);
  // what a texture not found becomes while the model loads: a tiny white picture (3 x 1, so it is told apart), dropped after
  let missingUrl = '';
  const MISSING = () => missingUrl || (missingUrl = (() => { const c = document.createElement('canvas'); c.width = 3; c.height = 1; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 3, 1); return c.toDataURL(); })());

  // ---- pictures: bytes made something to draw. The browser's own formats as an <img>, TGA through three.js's
  // TGALoader, TIFF, PSD and DDS through engine/images.js; a refused one throws its sentence
  const rgbaCanvas = (w, h, data) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    // (a browser keeps canvases under a size: 32,767 px a side in Chromium, less in all on an iPad)
    const x = w <= 16384 && h <= 16384 && c.width === w && c.height === h ? c.getContext('2d') : null;
    if (!x) throw new Error('a picture too large for this browser to draw: save it smaller');
    x.putImageData(new ImageData(data instanceof Uint8ClampedArray ? data : new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), w, h), 0, 0);
    return c;
  };
  async function toImage(buf, ext) {
    const k = IM.sniff(buf) || String(ext || '').toLowerCase();
    if (IM.way(k) === 'browser') {
      const url = URL.createObjectURL(new Blob([buf])), img = new Image();
      try { img.src = url; await img.decode(); } catch (e) { throw new Error(`a ${IM.FMT[k] || k} this browser could not read`); } finally { URL.revokeObjectURL(url); }
      return img;
    }
    if (k === 'tga') {
      if (!T.TGALoader) throw new Error('a TGA, and no TGA reader here');
      let r;
      try { r = new T.TGALoader().parse(buf); } catch (e) { throw new Error('a TGA that could not be read (' + String(e.message || e).replace(/^THREE\.TGALoader:\s*/, '') + ')'); }
      return rgbaCanvas(r.width, r.height, r.data);
    }
    const r = IM.decodeImage(k, buf);
    return rgbaCanvas(r.width, r.height, r.data);
  }
  // (drawn down to max px on its longer side when bigger)
  const shrink = (img, max) => {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (!max || Math.max(w, h) <= max) return img;
    const k = max / Math.max(w, h), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height);
    return c;
  };
  // a picture at an address, drawn down to o.max (o.ext: its kind when the address does not say, as a blob's)
  async function picture(url, o) {
    o = o || {};
    let r;
    try { r = await fetch(url); } catch (e) { throw new Error('it could not be fetched'); }
    if (!r.ok) throw Object.assign(new Error('it could not be fetched (HTTP ' + r.status + ')'), { status: r.status });
    return shrink(await toImage(await r.arrayBuffer(), o.ext || (/^blob:/i.test(url) ? '' : IM.extOf(url))), o.max);
  }
  const pngUrl = img => new Promise((res, rej) => {
    let c = img;
    if (!(c instanceof HTMLCanvasElement)) { c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height; c.getContext('2d').drawImage(img, 0, 0); }
    c.toBlob(b => (b ? res(URL.createObjectURL(b)) : rej(new Error('the picture could not be written'))), 'image/png');
  });
  // the mean colour of a picture (0 to 1; a small copy is enough): a normal map's bluish purple tells it apart
  const meanOf = img => {
    const c = document.createElement('canvas'), w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, k = Math.min(1, 64 / Math.max(w, h));
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, c.width, c.height);
    const d = x.getImageData(0, 0, c.width, c.height).data, m = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) for (let j = 0; j < 3; j++) m[j] += d[i + j];
    return m.map(v => v / (255 * (d.length / 4)));
  };

  // ---- units and up axis
  // An FBX's GlobalSettings: UnitScaleFactor (cm per unit), UpAxis and UpAxisSign. Binary: each is a P record of four
  // strings and a number (the name's length before it tells "UnitScaleFactor" from "OriginalUnitScaleFactor"); ASCII: a
  // line P: "UnitScaleFactor", "double", ..., 1. (GlobalSettings comes near the start: the first 4 MB are read)
  function fbxGuess(buf) {
    const out = { unit: 1, up: 1, sign: 1, gltf: false, read: false, format: 'FBX' };
    const u8 = new Uint8Array(buf), n = Math.min(u8.length, 4 << 20);
    let s = '';
    for (let i = 0; i < n; i += 65536) s += String.fromCharCode.apply(null, u8.subarray(i, Math.min(n, i + 65536)));
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let u, a, g;
    if (s.startsWith('Kaydara FBX Binary')) {
      out.format = 'binary FBX ' + (u8.length > 27 ? dv.getUint32(23, true) : '');
      const prop = name => {
        const L = name.length, pat = 'S' + String.fromCharCode(L & 255, (L >> 8) & 255, 0, 0) + name;
        let i = s.indexOf(pat);
        if (i < 0) return null;
        i += pat.length;
        for (let k = 0; k < 3; k++) { if (u8[i] !== 0x53) return null; i += 5 + dv.getUint32(i + 1, true); }
        const t = String.fromCharCode(u8[i]);
        return t === 'D' ? dv.getFloat64(i + 1, true) : t === 'F' ? dv.getFloat32(i + 1, true) : t === 'I' ? dv.getInt32(i + 1, true)
          : t === 'Y' ? dv.getInt16(i + 1, true) : t === 'L' ? Number(dv.getBigInt64(i + 1, true)) : null;
      };
      u = prop('UnitScaleFactor'); a = prop('UpAxis'); g = prop('UpAxisSign');
    } else {
      const v = /FBXVersion:\s*(\d+)/.exec(s);
      out.format = ('ASCII FBX ' + (v ? v[1] : '')).trim();
      const num = name => { const m = new RegExp('P:\\s*"' + name + '"\\s*,\\s*"[^"]*"\\s*,\\s*"[^"]*"\\s*,\\s*"[^"]*"\\s*,\\s*([-+0-9.eE]+)').exec(s); return m ? +m[1] : null; };
      u = num('UnitScaleFactor'); a = num('UpAxis'); g = num('UpAxisSign');
    }
    if (Number.isFinite(u) && u > 0) { out.unit = u; out.read = true; }
    if ([0, 1, 2].includes(a)) out.up = a;
    if (g === -1) out.sign = -1;
    return out;
  }
  // The scale and turn a file starts with (the studio stores them in the item; a GLB has them baked into its root). FBX:
  // its UnitScaleFactor (cm per unit) gives the scale factor / 100, Z up a quarter turn about x; that scale is taken only
  // when it makes the largest side 5 cm to 60 m, else 1 unit = 1 m when that does, else it is sized to 1 m. glTF is metres
  // and Y up. OBJ, PLY and STL say nothing of their units (free): metres, else centimetres, else millimetres when that
  // makes it 5 cm to 60 m, else sized to 1 m. how: 'unit', 'metres', 'cm', 'mm' or 'fit'; would: its largest side in the
  // file's own units, in metres (what the card says when they are refused)
  function guessFor(g, size) {
    const q = new T.Quaternion();
    if (g.up === 2) q.setFromAxisAngle(AX, -Math.PI / 2 * g.sign);
    else if (g.up === 0) q.setFromAxisAngle(AZ, Math.PI / 2 * g.sign);
    else if (g.sign < 0) q.setFromAxisAngle(AX, Math.PI);
    const L = Math.max(size.x, size.y, size.z) || 1, u = g.unit / 100, fits = c => L * c >= 0.05 && L * c <= 60;
    let how, s;
    if (g.free) { how = fits(1) ? 'metres' : fits(0.01) ? 'cm' : fits(0.001) ? 'mm' : 'fit'; s = { metres: 1, cm: 0.01, mm: 0.001, fit: 1 / L }[how]; }
    else { how = fits(u) ? 'unit' : fits(1) ? 'metres' : 'fit'; s = how === 'unit' ? u : how === 'metres' ? 1 : 1 / L; }
    return { s: +s.toPrecision(4), q: q.toArray().map(v => Math.round(v * 1e4) / 1e4), unit: g.unit, up: g.up, sign: g.sign, read: !!g.read, gltf: !!g.gltf, free: !!g.free, how, would: +(L * u).toPrecision(3) };
  }

  // ---- the files a model names, before it is loaded (the Upload pane's plan groups them with it)
  const IMG = /[^\0-\x1f"*:<>?\\/|]{1,160}?\.(png|jpe?g|tga|bmp|webp|gif|tiff?|dds|psd|exr|hdr)(?![a-z0-9])/gi;
  function namesIn(ext, buf) {
    const out = { textures: [], mtl: [], buffers: [] }, add = (list, n) => { n = baseOf(n).trim(); if (n && !list.some(x => x.toLowerCase() === n.toLowerCase())) list.push(n); };
    const u8 = new Uint8Array(buf);
    ext = String(ext).toLowerCase();
    if (ext === 'fbx') {
      // the file names of its textures: an author's full path (C:\Users\...\x.png) or a relative one; the base name counts
      let s = '';
      for (let i = 0; i < u8.length; i += 65536) s += String.fromCharCode.apply(null, u8.subarray(i, Math.min(u8.length, i + 65536)));
      const re = /[^\0-\x1f"*:<>?|]{1,240}?\.(png|jpe?g|tga|bmp|webp|gif|tiff?|dds|psd|exr|hdr)(?![a-z0-9])/gi;
      let m;
      while ((m = re.exec(s))) { const nm = baseOf(m[0].replace(/^.*[\\/]/, '')); if (/^[\w\-. ()[\]+,~'&@!$#%^]+$/.test(nm) && /[a-z0-9]/i.test(nm.replace(/\.[^.]+$/, ''))) add(out.textures, nm); }
    } else if (ext === 'obj') {
      const text = new TextDecoder().decode(u8);
      for (const m of text.matchAll(/^[ \t]*mtllib[ \t]+(.+?)[ \t]*$/gim)) add(out.mtl, m[1]);
    } else if (ext === 'gltf' || ext === 'glb') {
      const j = ext === 'glb' ? glbJSON(buf) : (() => { try { return JSON.parse(new TextDecoder().decode(u8)); } catch (e) { return null; } })();
      if (j) {
        for (const b of j.buffers || []) if (b && typeof b.uri === 'string' && !/^data:/i.test(b.uri)) add(out.buffers, decodeURIComponent(b.uri));
        for (const im of j.images || []) if (im && typeof im.uri === 'string' && !/^data:/i.test(im.uri)) { let u = im.uri; try { u = decodeURIComponent(u); } catch (e) { /* as it is */ } if (!out.textures.some(x => x.toLowerCase() === u.toLowerCase())) out.textures.push(u); }   // (its path kept: the ladder's first rung)
      }
    }
    return out;
  }
  // an MTL's textures (map_Kd, bump, norm...: the last of its words after the options), each with the path it gives
  const MTL_OPT = { '-bm': 1, '-blendu': 1, '-blendv': 1, '-boost': 1, '-cc': 1, '-clamp': 1, '-imfchan': 1, '-texres': 1, '-type': 1, '-mm': 2, '-o': 3, '-s': 3, '-t': 3 };
  function mtlNames(text) {
    const out = [];
    for (const m of String(text).matchAll(/^[ \t]*(map_\w+|bump|norm|disp|decal|refl)[ \t]+(.+?)[ \t]*$/gim)) {
      const w = m[2].split(/\s+/);
      let i = 0;
      while (i < w.length && MTL_OPT[w[i].toLowerCase()] !== undefined) i += 1 + MTL_OPT[w[i].toLowerCase()];
      const n = w.slice(i).join(' ').replace(/\\/g, '/').replace(/^(\.\/)+/, '');
      if (baseOf(n) && !out.some(x => x.toLowerCase() === n.toLowerCase())) out.push(n);
    }
    return out;
  }
  const mtllibs = text => [...String(text).matchAll(/^[ \t]*mtllib[ \t]+(.+?)[ \t]*$/gim)].map(m => m[1]);

  // ---- a model read. o: { ext, data (ArrayBuffer), base (the address its names are relative to), url(name) -> an
  // address or null (not found: it loads untextured and missing says so), maxTex (pictures read here drawn down to it) }.
  // The pictures it names that the browser cannot show (TIFF, PSD, DDS; a TGA under another name) are read first and
  // given to its loader as PNG (why: the sentence for one that could not be read; decoded: the ones read so)
  async function load(o) {
    const ext = String(o.ext).toLowerCase(), manager = new T.LoadingManager(), W = { n: 0, done: null }, missing = new Set();
    // (pict: the address a name stands for -> a PNG's blob address, '' unread; byName: a name, lower case, -> that address,
    // for the loader's names that resolve elsewhere (an FBX's full paths), null when two files of that name were read)
    const pict = new Map(), byName = new Map(), why = {}, decoded = [], blobs = new Map();
    const keyOf = u => { let b = baseOf(IM.psdBack(u)); try { b = decodeURIComponent(b); } catch (e) { /* as it is */ } return b.toLowerCase(); };
    const nameOf = u => { let b = baseOf(IM.psdBack(u)); try { b = decodeURIComponent(b); } catch (e) { /* as it is */ } return b; };
    // what the model asks for (textures, a .gltf's buffers): it is ready once each has come or failed (the manager's own
    // counters are private)
    const s0 = manager.itemStart.bind(manager), e0 = manager.itemEnd.bind(manager);
    manager.itemStart = u => { W.n++; s0(u); };
    manager.itemEnd = u => { e0(u); if (--W.n <= 0 && W.done) W.done(); };
    const named = u => {
      if (/^(blob|data):/i.test(u)) return u;
      u = IM.psdBack(u);
      const r = o.url(u), k = r && pict.has(r) ? r : byName.get(keyOf(u));
      if (k && pict.has(k)) { if (pict.get(k)) return pict.get(k); missing.add(nameOf(u)); return MISSING(); }
      if (r) return r;
      const n = nameOf(u);
      if (n && n !== 'undefined') missing.add(n);   // (the FBX loader asks for 'undefined' when a texture names no image)
      return MISSING();
    };
    manager.setURLModifier(named);
    // a name ending in .tga (the FBX loader sends those to the handler whatever they are, an MTL by its name): read as
    // whatever its bytes are (a TGA, or the PNG another rung of the ladder found), the manager waiting for it
    let tgaN = 0;
    manager.addHandler(/\.tga$/i, {
      setPath() { return this; }, setCrossOrigin() { return this; },
      load(url, onLoad, onProgress, onError) {
        const tex = new T.Texture(), key = 'tga:' + ++tgaN + ':' + url;
        manager.itemStart(key);
        fetch(manager.resolveURL(url)).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
          .then(buf => toImage(buf, 'tga')).then(img => { tex.image = shrink(img, o.maxTex); tex.name = tex.name || nameOf(url); tex.needsUpdate = true; if (onLoad) onLoad(tex); })
          .catch(e => { missing.add(nameOf(url)); if (onError) onError(e); }).finally(() => manager.itemEnd(key));
        return tex;
      },
    });
    // the pictures it names that its loader would not read (by the file each name stands for, its bytes first): read here
    const prep = async names => {
      for (const n of names) {
        const r = o.url(n), nk = keyOf(n);
        if (!r || /^data:/i.test(r)) continue;
        if (byName.has(nk) && byName.get(nk) !== r) byName.set(nk, null); else if (!byName.has(nk)) byName.set(nk, r);
        if (pict.has(r)) continue;
        const k = r;
        const fe = /^blob:/i.test(r) ? '' : IM.extOf(r);
        if (fe ? !IM.way(fe) || IM.way(fe) === 'browser' : !IM.isPicture(n)) continue;
        try {
          const res = await fetch(r);
          if (!res.ok) continue;
          const buf = await res.arrayBuffer(), kind = IM.sniff(buf) || fe || IM.extOf(n), w = IM.way(kind);
          if (w === 'browser') continue;   // (a PNG or JPEG under another name: the loader reads it)
          const url = await pngUrl(shrink(await toImage(buf, kind), o.maxTex));
          pict.set(k, url); blobs.set(url, nameOf(n));
          if (w === 'decode') decoded.push({ name: nameOf(n), fmt: IM.FMT[kind] || kind.toUpperCase() });
        } catch (e) { pict.set(k, ''); why[nameOf(n)] = String(e.message || e); missing.add(nameOf(n)); }
      }
    };
    const settle = () => new Promise(res => { if (W.n <= 0) res(); else { W.done = res; setTimeout(res, 60000); } });
    let root = null, clips = [], guess, asset = null;
    const u8 = new Uint8Array(o.data);
    // (the pictures read here given back whether the model loads or not: each may be as big as a texture)
    try {
      if (ext === 'fbx') {
        guess = fbxGuess(o.data);
        await prep(namesIn('fbx', o.data).textures);
        const ren = IM.renamePsd(o.data);   // (its .psd names, which its loader never asks for, made .ps~: back in named)
        root = new T.FBXLoader(manager).parse(ren.count ? ren.bytes : o.data, o.base);
        clips = root.animations || [];
      } else if (ext === 'glb' || ext === 'gltf') {
        await prep(namesIn(ext, o.data).textures);
        const g = await new Promise((res, rej) => new T.GLTFLoader(manager).parse(o.data, o.base, res, rej));
        root = g.scene || (g.scenes && g.scenes[0]); clips = g.animations || []; asset = g.asset || null;
        guess = { unit: 100, up: 1, sign: 1, read: true, gltf: true, format: ext === 'glb' ? 'binary glTF' : 'glTF' };
      } else if (ext === 'obj') {
        const text = new TextDecoder().decode(u8), loader = new T.OBJLoader(manager);
        // its materials: the MTL files it names, read through the same names (one creator for all of them)
        let mtl = '';
        for (const name of mtllibs(text)) {
          const u = o.url(name);
          if (!u) { missing.add(baseOf(name)); continue; }
          try { const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status); mtl += '\n' + await r.text(); } catch (e) { missing.add(baseOf(name)); }
        }
        if (mtl) { await prep(mtlNames(mtl)); const mc = new T.MTLLoader(manager).parse(mtl, o.base); mc.preload(); loader.setMaterials(mc); }
        root = loader.parse(text);
        guess = { unit: 100, up: 1, sign: 1, read: false, free: true, format: 'OBJ' };
      } else if (ext === 'ply' || ext === 'stl') {
        const geo = ext === 'ply' ? new T.PLYLoader().parse(o.data) : new T.STLLoader().parse(o.data);
        const col = !!geo.attributes.color;
        const m = new T.MeshStandardMaterial({ name: 'surface', color: col ? 0xffffff : 0xb8c2cf, vertexColors: col, roughness: 1, metalness: 0, transparent: geo.alpha !== undefined && geo.alpha < 1, opacity: geo.alpha !== undefined ? geo.alpha : 1 });
        const mesh = new T.Mesh(geo, m);
        mesh.name = o.name || ext;
        root = new T.Group(); root.add(mesh);
        guess = { unit: 100, up: 1, sign: 1, read: false, free: true, format: ext.toUpperCase() };
      } else throw new Error('Unknown format: ' + ext);
      if (!root) throw new Error('the file has no scene in it');
      if (W.n > 0) await settle();
      // pictures loaded but not yet decoded, decoded now (so the conversion and its times include them); the ones not found
      // (the 3 x 1 stand-in) left out
      const images = new Set();
      root.traverse(n => {
        for (const m of [].concat(n.material || [])) for (const k of TEX_KEYS) {
          const t = m[k];
          if (!t || !t.isTexture) continue;
          const im = t.image;
          if (im && im.width === 3 && im.height === 1 && missing.size) { m[k] = null; m.needsUpdate = true; continue; }
          if (im) images.add(im);
          if (im && typeof im.src === 'string' && blobs.has(im.src)) t.name = t.name || blobs.get(im.src);   // (a picture read here: its own name)
        }
      });
      for (const im of images) if (im.decode) { try { await im.decode(); } catch (e) { /* drawn as it is */ } }
      // (a GLB written with its pictures' gaps filled: they are not filled again when it is made again from itself)
      const rec = asset ? glbRecord({ asset }) : null;
      if (rec && rec.fill) root.traverse(n => { for (const m of [].concat(n.material || [])) for (const k of TEX_KEYS) if (m[k] && m[k].isTexture) FILLED.add(m[k]); });
      return { root, clips, guess, asset, missing: [...missing], ext, why, decoded };
    } finally { for (const u of blobs.keys()) URL.revokeObjectURL(u); }
  }

  // ---- a GLB's JSON chunk, a GLB with it changed, and the studio's record in it
  function glbJSON(buf) {
    try {
      const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      if (u8.length < 20 || dv.getUint32(0, true) !== 0x46546c67 || dv.getUint32(16, true) !== 0x4e4f534a) return null;
      const n = dv.getUint32(12, true);
      if (20 + n > u8.length) return null;
      return JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + n)));
    } catch (e) { return null; }
  }
  function glbPatch(buf, fn) {
    const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), n = dv.getUint32(12, true);
    const j = glbJSON(buf);
    if (!j) throw new Error('not a binary glTF');
    fn(j);
    let js = new TextEncoder().encode(JSON.stringify(j));
    const pad = (4 - (js.length % 4)) % 4, rest = u8.subarray(20 + n), out = new Uint8Array(20 + js.length + pad + rest.length);
    const ov = new DataView(out.buffer);
    out.set(u8.subarray(0, 12)); ov.setUint32(8, out.length, true);
    ov.setUint32(12, js.length + pad, true); ov.setUint32(16, 0x4e4f534a, true);
    out.set(js, 20); out.fill(0x20, 20 + js.length, 20 + js.length + pad);
    out.set(rest, 20 + js.length + pad);
    return out.buffer;
  }
  // asset.extras.studio: { from: the original's path, s: the scale baked in, q: the turn baked in, at: ms, scan: no normals,
  // tex: the pictures laid on, [{ name (the name the model gave, '' for a slot added), mat (a material's name, or its
  // index; '*' every one without that slot), slot, from (the picture's path in the scene), how }], tris: { from, to,
  // keep } when it was made lighter (Fewer triangles), fill: how many of its pictures had the gaps between their pieces
  // filled (fillModel) }
  const SLOT_OK = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'orm'];
  const HOW_OK = ['path', 'name', 'ext', 'similar', 'only', 'chosen', 'stem'];
  const texList = list => (Array.isArray(list) ? list : []).filter(x => x && typeof x === 'object' && typeof x.from === 'string' && x.from && (x.name || SLOT_OK.includes(x.slot))).slice(0, 40).map(x => ({
    name: typeof x.name === 'string' ? x.name.slice(0, 160) : '', mat: Number.isInteger(x.mat) && x.mat >= 0 && x.mat < 1000 ? x.mat : typeof x.mat === 'string' ? x.mat.slice(0, 80) : '',
    slot: SLOT_OK.includes(x.slot) ? x.slot : '', from: x.from.slice(0, 200), how: HOW_OK.includes(x.how) ? x.how : 'chosen' }));
  function glbRecord(j) {
    const r = j && j.asset && j.asset.extras && j.asset.extras.studio;
    if (!r || typeof r !== 'object') return null;
    const q = Array.isArray(r.q) && r.q.length === 4 && r.q.every(Number.isFinite) ? r.q : [0, 0, 0, 1];
    // (tris: the triangles of what it was made from, of the GLB, and the share asked: Fewer triangles)
    const tr = r.tris && typeof r.tris === 'object' && Number.isFinite(r.tris.from) && Number.isFinite(r.tris.to) && r.tris.from > 0 && r.tris.to >= 0
      ? { from: Math.round(r.tris.from), to: Math.round(r.tris.to), keep: Number.isFinite(r.tris.keep) && r.tris.keep > 0 ? Math.min(1, r.tris.keep) : Math.min(1, r.tris.to / r.tris.from) } : null;
    // (fill: how many of its pictures have the gaps between their pieces filled)
    const fl = Number.isFinite(r.fill) && r.fill > 0 ? Math.min(99, Math.round(r.fill)) : 0;
    return { from: typeof r.from === 'string' ? r.from.slice(0, 200) : '', s: Number.isFinite(r.s) && r.s > 0 ? r.s : 1, q, at: +r.at || 0, scan: !!r.scan, tex: texList(r.tex), tris: tr, fill: fl };
  }

  // ---- pictures laid onto materials. matsOf: the model's materials in the order they are met, each with whether its
  // meshes have texture coordinates and the slots it has pictures in (key: its name when no other has it, else its index)
  function matsOf(root) {
    const out = [], seen = new Map();
    root.traverse(n => {
      if (!n.isMesh) return;
      for (const m of [].concat(n.material || [])) {
        let e = seen.get(m);
        if (!e) { e = { m, name: m.name || '', uv: false, meshes: [] }; seen.set(m, e); out.push(e); }
        e.meshes.push(n);
        if (n.geometry && n.geometry.attributes.uv) e.uv = true;
      }
    });
    out.forEach((e, i) => { e.i = i; e.key = e.name && out.filter(x => x.name === e.name).length === 1 ? e.name : i; e.slots = SLOT_OK.filter(k => k !== 'orm' && e.m[k] && e.m[k].isTexture); });
    return out;
  }
  // list: [{ mat, slot, image, name }] (image a picture from picture()); o.gltf: the model came through glTF's loader
  // (pictures the right way up: flipY off). An 'orm' picture (occlusion, roughness, metalness packed in red, green and
  // blue) goes in all three. -> { done, why: [sentences] }
  function addTextures(root, list, o) {
    o = o || {};
    const mats = matsOf(root), why = [];
    let done = 0;
    for (const x of list) {
      const keys = x.slot === 'orm' ? ['aoMap', 'roughnessMap', 'metalnessMap'] : [x.slot];
      const want = x.mat === '*' ? mats.filter(e => e.uv && !keys.some(k => e.m[k])) : mats.filter(e => e.key === x.mat || e.name === x.mat || e.i === x.mat).slice(0, 1);
      if (!want.length) { if (x.mat !== '*') why.push(`${x.name || 'a picture'}: the model has no material ${JSON.stringify(x.mat)}`); continue; }
      for (const e of want) {
        if (!e.uv) { why.push(`${e.name || 'its material'}: it has no texture coordinates (UVs), so a picture cannot be laid on it`); continue; }
        const t = new T.Texture(x.image);
        t.name = x.name || ''; t.flipY = !o.gltf; t.wrapS = t.wrapT = T.RepeatWrapping; t.needsUpdate = true;
        for (const k of keys) e.m[k] = t;
        if (keys.includes('aoMap')) for (const n of e.meshes) { const g = n.geometry; if (g && g.attributes.uv && !g.attributes.uv2) g.setAttribute('uv2', g.attributes.uv); }
        if (keys.includes('emissiveMap') && e.m.emissive && e.m.emissive.r + e.m.emissive.g + e.m.emissive.b === 0) e.m.emissive.setRGB(1, 1, 1);
        if (keys.includes('alphaMap')) e.m.transparent = true;
        if (keys.includes('roughnessMap') && 'roughness' in e.m) e.m.roughness = 1;   // (the picture says how rough: its factor is a multiplier)
        if (keys.includes('metalnessMap') && 'metalness' in e.m) e.m.metalness = 1;
        e.m.needsUpdate = true;
        done++;
      }
    }
    return { done, why };
  }

  // ---- numbers for both sides of the comparison
  function stats(root, cl) {
    let tris = 0, verts = 0, meshes = 0, skinned = 0, normals = true;
    const bones = new Set(), tex = new Map(), bufs = new Set();   // (bones: the skeletons' joints; a loader makes other bones plain nodes)
    root.traverse(o => {
      if (!o.isMesh) return;
      meshes++;
      if (o.isSkinnedMesh) { skinned++; for (const b of o.skeleton.bones) bones.add(b); }
      const g = o.geometry, n = g.index ? g.index.count : g.attributes.position.count;
      tris += n / 3; verts += g.attributes.position.count;
      if (!g.attributes.normal) normals = false;
      for (const a of [g.index, ...Object.values(g.attributes), ...Object.values(g.morphAttributes || {}).flat()]) if (a && a.array) bufs.add(a.array);
      for (const m of [].concat(o.material || [])) for (const k of TEX_KEYS) {
        const t = m[k];
        if (t && t.isTexture && !tex.has(t.image || t)) tex.set(t.image || t, { w: (t.image && (t.image.naturalWidth || t.image.width)) || 0, h: (t.image && (t.image.naturalHeight || t.image.height)) || 0, kind: t.format === T.RGBFormat ? 'JPEG' : '' });
      }
    });
    const size = new T.Box3().setFromObject(root).getSize(new T.Vector3()).toArray();
    const textures = [...tex.values()].filter(t => t.w);
    // the headset's memory for it, about: its vertex buffers, and every texture as RGBA with its mipmaps (4/3)
    const gpu = [...bufs].reduce((n, a) => n + a.byteLength, 0) + textures.reduce((n, t) => n + (t.w * t.h * 4 * 4) / 3, 0);
    return { tris: Math.round(tris), verts, meshes, skinned, bones: bones.size, size, textures, gpu, normals, clips: cl.map(c => ({ name: c.name, duration: c.duration, tracks: c.tracks.length })) };
  }
  const disposeTree = root => {
    const seen = new Set();
    root.traverse(o => {
      if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      for (const m of [].concat(o.material || [])) {
        if (seen.has(m)) continue;
        seen.add(m);
        for (const k of TEX_KEYS) if (m[k] && m[k].isTexture && !seen.has(m[k])) { seen.add(m[k]); m[k].dispose(); }
        m.dispose();
      }
    });
  };

  // ---- corners welded: a vertex for every distinct corner (all its attributes the same, bit for bit), and an index.
  // -> { attrs: [[name, attribute]], morphs: [[name, i, attribute]], index, was, now }, or null (indexed already, an
  // interleaved attribute, or nothing repeated). The geometry given is not changed
  function weldOf(gm) {
    if (gm.index) return null;
    const attrs = Object.entries(gm.attributes), morphs = Object.entries(gm.morphAttributes || {}).flatMap(([nm, list]) => list.map((a, i) => [nm, i, a]));
    if ([...attrs.map(a => a[1]), ...morphs.map(x => x[2])].some(a => a.isInterleavedBufferAttribute)) return null;
    const cnt = gm.attributes.position.count, cols = [...attrs.map(a => a[1]), ...morphs.map(x => x[2])];
    const views = cols.map(a => (a.array instanceof Float32Array ? new Uint32Array(a.array.buffer, a.array.byteOffset, a.array.length) : a.array));
    const sizes = cols.map(a => a.itemSize);
    let cap = 1; while (cap < cnt * 2) cap <<= 1;
    const table = new Int32Array(cap).fill(-1), remap = new Uint32Array(cnt), first = [];
    for (let v = 0; v < cnt; v++) {
      let h = 2166136261;
      for (let c = 0; c < views.length; c++) { const a = views[c], s = sizes[c]; for (let j = v * s, e = j + s; j < e; j++) h = Math.imul(h ^ a[j], 16777619); }
      let slot = (h >>> 0) & (cap - 1);
      for (;;) {
        const u = table[slot];
        if (u < 0) { table[slot] = first.length; remap[v] = first.length; first.push(v); break; }
        const w = first[u];
        let same = true;
        for (let c = 0; c < views.length && same; c++) { const a = views[c], s = sizes[c]; for (let j = 0; j < s; j++) if (a[v * s + j] !== a[w * s + j]) { same = false; break; } }
        if (same) { remap[v] = u; break; }
        slot = (slot + 1) & (cap - 1);
      }
    }
    if (first.length === cnt) return null;
    const pick = a => { const s = a.itemSize, arr = new a.array.constructor(first.length * s); for (let i = 0; i < first.length; i++) for (let j = 0; j < s; j++) arr[i * s + j] = a.array[first[i] * s + j]; return new T.BufferAttribute(arr, s, a.normalized); };
    return { attrs: attrs.map(([nm, a]) => [nm, pick(a)]), morphs: morphs.map(([nm, i, a]) => [nm, i, pick(a)]), index: new T.BufferAttribute(first.length < 65536 ? new Uint16Array(remap) : remap, 1), was: cnt, now: first.length };
  }

  // ---- fewer triangles (tools/studio/SPEC.md, "Fewer triangles"): meshoptimizer's simplifier (vendored: the studio's
  // meshoptLoad(), or convert.mjs's MeshoptSimplifier; its WebAssembly made when first asked). Every mesh keeps the same
  // share of its triangles (keep, 0.02 to 1), its corners welded first. Its normals and texture coordinates weigh in, so
  // a texture stays where it was (its seams are kept); corners a part shares with another part (another mesh or material
  // touching it) are locked, so the parts do not crack apart; tiny loose pieces are pruned. How far a corner may move
  // starts strict and is loosened until the count is reached (or as near as its seams and borders allow). Its corners are
  // a subset of the old ones, so a skinned mesh keeps its bones' weights; a mesh with shape keys (morph targets) is left
  // as it is. o.inPlace: each mesh is given its new geometry (a model loaded for converting). -> { from, to, keep, geos:
  // Map(old geometry -> new), notes, morph (meshes left as they were), err (the largest error, a share of the size), ms }
  const KEEP_MIN = 0.02;
  const simplifier = async () => {
    const S = H.simplifier ? H.simplifier() : typeof MeshoptSimplifier !== 'undefined' ? MeshoptSimplifier : null;   // eslint-disable-line no-undef
    if (!S) throw new Error('no simplifier here (meshoptimizer)');
    await S.ready;
    return S;
  };
  // an attribute as a plain one of its own kind (an interleaved one taken apart); its first k components as floats
  // (normalised integers as -1 to 1 or 0 to 1)
  const GET = ['getX', 'getY', 'getZ', 'getW'], NORM = { Int8Array: 127, Uint8Array: 255, Int16Array: 32767, Uint16Array: 65535, Int32Array: 2147483647, Uint32Array: 4294967295 };
  const plainAttr = a => {
    if (!a.isInterleavedBufferAttribute) return a;
    const n = a.count, s = a.itemSize, arr = new a.array.constructor(n * s);
    for (let i = 0; i < n; i++) for (let j = 0; j < s && j < 4; j++) arr[i * s + j] = a[GET[j]](i);
    return new T.BufferAttribute(arr, s, a.normalized);
  };
  const floats = (a, k, out, off, stride) => {
    const n = a.count, s = a.itemSize, src = a.array, d = a.normalized ? NORM[src.constructor.name] || 1 : 1;
    for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) out[i * stride + off + j] = j < s ? src[i * s + j] / d : 0;
    return out;
  };
  async function reduce(root, keep, o) {
    o = o || {};
    const t0 = performance.now();
    keep = Math.min(1, Math.max(KEEP_MIN, +keep || 1));
    const S = await simplifier(), notes = [], geos = new Map(), work = new Map();
    root.updateMatrixWorld(true);
    let from = 0, morph = 0, err = 0, short = 0, pruned = 0;
    const meshes = [];
    root.traverse(n => { if (n.isMesh && n.geometry && n.geometry.attributes.position) meshes.push(n); });
    for (const n of meshes) {
      const g = n.geometry;
      from += (g.index ? g.index.count : g.attributes.position.count) / 3;
      if (Object.values(g.morphAttributes || {}).some(l => l && l.length)) { morph++; continue; }
      if (!work.has(g)) work.set(g, { src: g, mesh: n, meshes: [] });
      work.get(g).meshes.push(n);
    }
    from = Math.round(from);
    // each geometry plain, welded and indexed (a copy: the one given is not changed), its material groups as parts
    const items = [...work.values()];
    let nParts = 0;
    for (const w of items) {
      const g = w.src, gm = new T.BufferGeometry();
      for (const [nm, a] of Object.entries(g.attributes)) gm.setAttribute(nm, plainAttr(a));
      if (g.index) gm.setIndex(new T.BufferAttribute(Uint32Array.from(g.index.array.subarray(0, g.index.count)), 1));
      else {
        const wd = weldOf(gm), n = gm.attributes.position.count;
        if (wd) { for (const [nm, a] of wd.attrs) gm.setAttribute(nm, a); gm.setIndex(new T.BufferAttribute(Uint32Array.from(wd.index.array), 1)); }
        else { const ix = new Uint32Array(n); for (let i = 0; i < n; i++) ix[i] = i; gm.setIndex(new T.BufferAttribute(ix, 1)); }
      }
      const ic = gm.index.count;
      w.gm = gm;
      // (groups count only where its meshes draw them: an array of materials; else three.js draws the whole index)
      w.multi = !!(g.groups && g.groups.length && w.meshes.every(msh => Array.isArray(msh.material)));
      w.groups = (w.multi ? g.groups : [{ start: 0, count: ic, materialIndex: 0 }]).map(x => ({ start: Math.max(0, x.start), count: Math.max(0, Math.min(x.count, ic - x.start)), materialIndex: x.materialIndex || 0 })).filter(x => x.count >= 3);
      w.part0 = nParts; nParts += w.groups.length;
      w.lock = null;
    }
    // corners shared between parts (two materials of one mesh, or two meshes touching where they meet), locked: found by
    // where they are in the model (a grid a hundred-thousandth of its size), each corner with the parts it is in
    if (nParts > 1) {
      const size = new T.Box3().setFromObject(root).getSize(new T.Vector3()).length(), eps = Math.max(1e-9, size * 1e-5);
      let total = 0;
      for (const w of items) total += w.gm.attributes.position.count;
      let cap = 1; while (cap < total * 2) cap <<= 1;
      const tab = new Int32Array(cap).fill(-1), KX = new Int32Array(total), KY = new Int32Array(total), KZ = new Int32Array(total), PT = new Int32Array(total), MULTI = new Uint8Array(total);
      let used = 0;
      const inv = new T.Matrix4().copy(root.matrixWorld).invert(), M = new T.Matrix4(), v = new T.Vector3();
      for (const w of items) {
        const gm = w.gm, n = gm.attributes.position.count, P = floats(gm.attributes.position, 3, new Float32Array(n * 3), 0, 3), ix = gm.index.array;
        const vp = new Int32Array(n).fill(-1), lock = new Uint8Array(n), ent = new Int32Array(n).fill(-1);
        w.groups.forEach((gr, gi) => { for (let i = gr.start; i < gr.start + gr.count; i++) { const k = ix[i]; if (vp[k] < 0) vp[k] = w.part0 + gi; else if (vp[k] !== w.part0 + gi) lock[k] = 1; } });
        M.multiplyMatrices(inv, w.mesh.matrixWorld);
        for (let k = 0; k < n; k++) {
          if (vp[k] < 0) continue;
          v.set(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]).applyMatrix4(M);
          const x = Math.round(v.x / eps), y = Math.round(v.y / eps), z = Math.round(v.z / eps);
          let slot = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) & (cap - 1);
          for (;;) {
            const e = tab[slot];
            if (e < 0) { tab[slot] = used; KX[used] = x; KY[used] = y; KZ[used] = z; PT[used] = vp[k]; ent[k] = used++; break; }
            if (KX[e] === x && KY[e] === y && KZ[e] === z) { if (PT[e] !== vp[k]) MULTI[e] = 1; ent[k] = e; break; }
            slot = (slot + 1) & (cap - 1);
          }
        }
        w.ent = ent; w.lock = lock;
      }
      for (const w of items) {
        let any = false;
        for (let k = 0; k < w.ent.length; k++) if (w.ent[k] >= 0 && MULTI[w.ent[k]]) { w.lock[k] = 1; any = true; }
        if (!any && !w.lock.some(x => x)) w.lock = null;
        w.ent = null;
      }
    }
    // each part made lighter: the share asked of its triangles, the limit loosened (1 %, 10 %, the whole size) until the
    // count is within a tenth of it; a part with no texture coordinates may then collapse across its hard edges too
    for (const w of items) {
      const gm = w.gm, n = gm.attributes.position.count, ix = gm.index.array, nrm = gm.attributes.normal, uv = gm.attributes.uv;
      const pos = floats(gm.attributes.position, 3, new Float32Array(n * 3), 0, 3);
      const k = (nrm ? 3 : 0) + (uv ? 2 : 0) || 1, A = new Float32Array(n * k), W = [];
      if (nrm) { floats(nrm, 3, A, 0, k); W.push(0.5, 0.5, 0.5); }
      if (uv) { floats(uv, 2, A, nrm ? 3 : 0, k); W.push(1, 1); }
      const out = [], gout = [];
      for (const gr of w.groups) {
        let sub = ix.slice(gr.start, gr.start + gr.count - (gr.count % 3)), res = sub;
        const tris = sub.length / 3;
        if (tris >= 16) {
          // (tiny loose pieces first, under a hundredth of its size: crumbs of a scan; never with the looser limits below,
          // which would take whole arms off a figure made of separate parts)
          const pr = S.simplifyPrune(sub, pos, 3, 0.01);
          if (pr.length >= 3 && pr.length < sub.length) { pruned += (sub.length - pr.length) / 3; sub = pr; }
          const target = Math.max(3, Math.round(tris * keep) * 3), fl = sub.length * 2 < n ? ['Sparse'] : [];
          let r = null;
          for (const e of [0.01, 0.1, 1]) {
            r = S.simplifyWithAttributes(sub, pos, 3, A, k, W, w.lock, Math.min(target, sub.length), e, fl);
            if (r[0].length <= target * 1.1) break;
          }
          if (r[0].length > target * 1.25 && !uv) { const p = S.simplifyWithAttributes(sub, pos, 3, A, k, W, w.lock, Math.min(target, sub.length), 1, fl.concat('Permissive')); if (p[0].length < r[0].length) r = p; }
          if (r[0].length > target * 1.25) short++;
          if (r[0].length >= 3) { res = r[0]; err = Math.max(err, r[1]); }
        }
        gout.push({ start: out.reduce((a, x) => a + x.length, 0), count: res.length, materialIndex: gr.materialIndex });
        out.push(res);
        if (tris > 20000) await yieldNow();
      }
      // (nothing taken away: the geometry stays as it was)
      if (out.reduce((a, x) => a + x.length, 0) >= w.groups.reduce((a, gr) => a + gr.count - (gr.count % 3), 0)) { gm.dispose(); w.gm = null; continue; }
      // only the corners still used, in their order (so a skinned mesh's weights and every other attribute come along)
      const all = new Uint32Array(out.reduce((a, x) => a + x.length, 0));
      let o2 = 0;
      for (const x of out) { all.set(x, o2); o2 += x.length; }
      const map = new Int32Array(n).fill(-1);
      let m = 0;
      for (let i = 0; i < all.length; i++) { const q = all[i]; if (map[q] < 0) map[q] = m++; all[i] = map[q]; }
      const ng = new T.BufferGeometry();
      for (const [nm, a] of Object.entries(gm.attributes)) {
        const s = a.itemSize, arr = new a.array.constructor(m * s);
        for (let q = 0; q < n; q++) { const t = map[q]; if (t >= 0) for (let j = 0; j < s; j++) arr[t * s + j] = a.array[q * s + j]; }
        ng.setAttribute(nm, new T.BufferAttribute(arr, s, a.normalized));
      }
      ng.setIndex(new T.BufferAttribute(m < 65536 ? new Uint16Array(all) : all, 1));
      if (w.multi) for (const gr of gout) ng.addGroup(gr.start, gr.count, gr.materialIndex);
      ng.name = w.src.name; ng.userData = Object.assign({}, w.src.userData);
      ng.computeBoundingBox(); ng.computeBoundingSphere();
      gm.dispose();
      w.gm = null;
      geos.set(w.src, ng);
      if (o.inPlace) { for (const msh of w.meshes) msh.geometry = ng; w.src.dispose(); }
    }
    let to = 0;
    for (const n of meshes) { const g = geos.get(n.geometry) || n.geometry; to += (g.index ? g.index.count : g.attributes.position.count) / 3; }
    to = Math.round(to);
    const pc = v => (v * 100 >= 10 ? Math.round(v * 100) : +(v * 100).toPrecision(2)) + ' %';
    notes.push(`fewer triangles: ${from.toLocaleString('en-GB')} became ${to.toLocaleString('en-GB')} (${pc(to / Math.max(1, from))}; ${pc(keep)} asked)`);
    if (pruned) notes.push(`${Math.round(pruned).toLocaleString('en-GB')} triangles of tiny loose pieces left out`);
    if (err > 0.02) notes.push(`its surface moved by up to ${(err * 100).toFixed(err < 0.1 ? 1 : 0)} % of its size to come down this far: look at it before keeping it`);
    if (short) notes.push(`${short} part${short === 1 ? '' : 's'} could not come down as far as asked (seams and borders kept)`);
    if (morph) notes.push(`${morph} mesh${morph === 1 ? '' : 'es'} with shape keys (morph targets) left as ${morph === 1 ? 'it is' : 'they are'}`);
    return { from, to, keep, geos, notes, morph, err, ms: Math.round(performance.now() - t0) };
  }

  // ---- the gaps between a picture's pieces filled (tools/studio/SPEC.md, "Fewer triangles": the fill; the owner, 6
  // November 2026: "leaves black artifacts in the textured models"). A scan's texture is an atlas of many small pieces
  // with black, unused texels between them; a lighter model keeps its seams joined in 3D but straightens each piece's
  // outline in the picture, so at 10 % its triangles sample the black between pieces: black wedges along the seams (and
  // even all its triangles show thin dark seams once mipmapped). Every texel no triangle of the model as it is now uses
  // is filled from the nearest one that does (engine/images.js: cover and fillGaps), the used ones never changed, so
  // whatever share is kept later samples colours of its own piece. Only where it makes sense: texture coordinates within
  // 0 to 1 (a picture that repeats across the model, tiles, is left alone), under 95 % of it used, every mesh showing it
  // with texture coordinates. Every slot is filled with its own values (a normal map with normals, never black); alpha
  // kept as it is where a material reads it (see-through or cut out), else filled too (a canvas cannot hold a colour
  // where alpha is 0). Done on the model before it is made lighter
  const FILL_SLOTS = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap'];
  // (three.js r128 reads every picture on the first texture coordinates through one transform, the first of these a
  // material has; the occlusion picture through the second set, and its own)
  const UV_FIRST = ['map', 'specularMap', 'displacementMap', 'normalMap', 'bumpMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'emissiveMap'];
  const uvXf = (mt, two) => {
    const t = two ? mt.aoMap || mt.lightMap : UV_FIRST.map(k => mt[k]).find(x => x && x.isTexture);
    if (!t) return null;
    if (t.matrixAutoUpdate) t.updateMatrix();
    const e = t.matrix.elements;
    return e[0] === 1 && e[1] === 0 && e[3] === 0 && e[4] === 1 && e[6] === 0 && e[7] === 0 ? null : [e[0], e[1], e[3], e[4], e[6], e[7]];
  };
  const sizeOf = img => [img && (img.naturalWidth || img.width || 0), img && (img.naturalHeight || img.height || 0)];
  // (the textures whose gaps are filled: a GLB's that says so, and the ones filled here; three.js r128's textures have
  // no userData)
  const FILLED = new WeakSet(), filled = t => FILLED.has(t);
  // the pictures a model shows, each with its textures and the triangles that show it (by geometry, texture coordinates,
  // range of its index, transform and way up)
  function fillPlan(root) {
    const plan = new Map();
    root.traverse(n => {
      if (!n.isMesh || !n.geometry || !n.geometry.attributes.position) return;
      const g = n.geometry, ms = [].concat(n.material || []), multi = Array.isArray(n.material) && g.groups && g.groups.length > 0;
      const all = g.index ? g.index.count : g.attributes.position.count;
      ms.forEach((mt, mi) => {
        if (!mt) return;
        const ranges = multi ? g.groups.filter(gr => (gr.materialIndex || 0) === mi).map(gr => [Math.max(0, gr.start), Math.min(all, gr.start + gr.count)]) : [[0, all]];
        for (const slot of FILL_SLOTS) {
          const t = mt[slot];
          if (!t || !t.isTexture) continue;
          const [w, h] = sizeOf(t.image);
          if (!w || !h) continue;
          let e = plan.get(t.image);
          if (!e) plan.set(t.image, e = { img: t.image, w, h, texs: new Set(), uses: new Map(), why: '', alpha: false });
          e.texs.add(t);
          if (slot === 'map' && (mt.transparent || mt.alphaTest > 0)) e.alpha = true;
          const two = slot === 'aoMap', name = two && g.attributes.uv2 ? 'uv2' : 'uv', uv = g.attributes[name];
          if (!uv) { e.why = e.why || 'a mesh shows it without texture coordinates'; continue; }
          const xf = uvXf(mt, two), rep = t.wrapS !== T.ClampToEdgeWrapping || t.wrapT !== T.ClampToEdgeWrapping, flip = t.flipY !== false;
          for (const [s, f] of ranges) e.uses.set([g.uuid, name, s, f, xf, flip, rep].join('|'), { g, uv, s, f, xf, flip, rep });
        }
      });
    });
    return plan;
  }
  // o: { copy (each filled picture a new canvas: the model's own stay as they are; else filled where it is, a canvas of
  // its own, or the textures given a new one) }; a picture all of whose textures are filled already is left as it is. -> { list: [{ img,
  // canvas, texs, share, ms }] filled, again (pictures filled already), why: [reasons a picture was left alone], ms }
  async function fillModel(root, o) {
    o = o || {};
    const t0 = performance.now(), plan = fillPlan(root), list = [], why = [];
    let again = 0, last = t0;
    const uvs = new Map(), pace = async () => { if (performance.now() - last > 25) { await yieldNow(); last = performance.now(); } };
    for (const e of plan.values()) {
      if (e.why) { why.push(e.why); continue; }
      if ([...e.texs].every(filled)) { again++; continue; }
      const { w, h } = e, N = w * h;
      if (w < 16 || h < 16 || !e.uses.size) continue;   // (too small to matter)
      const t1 = performance.now(), cov = new Uint8Array(N);
      let tiles = false;
      for (const u of e.uses.values()) {
        const key = u.g.uuid + '|' + (u.uv === u.g.attributes.uv2 ? 'uv2' : 'uv');
        let A = uvs.get(key);
        if (!A) uvs.set(key, A = floats(plainAttr(u.uv), 2, new Float32Array(u.uv.count * 2), 0, 2));
        const n = u.uv.count, P = new Float32Array(n * 2), x = u.xf, ix = u.g.index ? u.g.index.array : null;
        // (which corners the range uses, and whether any of them reads past 0 to 1: a picture that tiles)
        const used = new Uint8Array(n);
        for (let i = u.s; i < u.f; i++) used[ix ? ix[i] : i] = 1;
        for (let v = 0; v < n; v++) {
          if (!used[v]) continue;
          let a = A[v * 2], b = A[v * 2 + 1];
          if (x) { const a2 = x[0] * a + x[2] * b + x[4]; b = x[1] * a + x[3] * b + x[5]; a = a2; }
          if (a < -1e-3 || a > 1.001 || b < -1e-3 || b > 1.001) { if (u.rep) { tiles = true; break; } a = Math.min(1, Math.max(0, a)); b = Math.min(1, Math.max(0, b)); }
          P[v * 2] = a * w; P[v * 2 + 1] = (u.flip ? 1 - b : b) * h;
        }
        if (tiles) break;
        IM.cover(cov, w, h, P, ix, u.s, u.f);
        await pace();
      }
      if (tiles) { why.push('a picture repeats across the model (tiles)'); continue; }
      let c = 0;
      for (let i = 0; i < N; i++) c += cov[i];
      const share = c / N;
      if (!c || share >= 0.95) { if (c) why.push('a picture is nearly all used'); continue; }
      // its bytes (a canvas of its own when it is one and nothing asks for a copy), filled, and put back
      const own = !o.copy && typeof HTMLCanvasElement !== 'undefined' && e.img instanceof HTMLCanvasElement, cv = own ? e.img : document.createElement('canvas');
      if (!own) { cv.width = w; cv.height = h; cv.getContext('2d').drawImage(e.img, 0, 0, w, h); }
      const x = cv.getContext('2d'), id = x.getImageData(0, 0, w, h);
      const r = await IM.fillGaps(id.data, w, h, cov, { alpha: !e.alpha, pause: yieldNow });
      x.putImageData(id, 0, 0);
      if (!o.copy) for (const t of e.texs) { if (!own) t.image = cv; FILLED.add(t); t.needsUpdate = true; }
      list.push({ img: e.img, canvas: cv, texs: [...e.texs], share, ms: Math.round(performance.now() - t1), filled: r.filled });
    }
    return { list, again, why: [...new Set(why)], ms: Math.round(performance.now() - t0) };
  }

  // ---- how many triangles a model file holds, read cheaply from its bytes (the Upload pane's rows, before loading it):
  // glTF from its accessors, OBJ from its faces, STL from its count, PLY from its header (faces taken as triangles), FBX
  // from its polygons' corners (PolygonVertexIndex); null when it cannot be told
  function triCount(ext, buf) {
    try {
      ext = String(ext).toLowerCase();
      const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      if (ext === 'glb' || ext === 'gltf') {
        const j = ext === 'glb' ? glbJSON(buf) : JSON.parse(new TextDecoder().decode(u8));
        if (!j || !j.meshes) return null;
        const acc = j.accessors || [], per = j.meshes.map(me => (me.primitives || []).reduce((t, p) => {
          const mode = p.mode === undefined ? 4 : p.mode, a = acc[p.indices !== undefined ? p.indices : p.attributes && p.attributes.POSITION], c = a ? a.count : 0;
          return t + (mode === 4 ? Math.floor(c / 3) : mode === 5 || mode === 6 ? Math.max(0, c - 2) : 0);
        }, 0));
        const uses = (j.nodes || []).filter(nd => Number.isInteger(nd.mesh));
        return uses.length ? uses.reduce((t, nd) => t + (per[nd.mesh] || 0), 0) : per.reduce((a, b) => a + b, 0);
      }
      if (ext === 'stl') {
        if (u8.length >= 84 && 84 + dv.getUint32(80, true) * 50 === u8.length) return dv.getUint32(80, true);
        const s = new TextDecoder().decode(u8);
        return (s.match(/\bendfacet\b/g) || []).length;
      }
      if (ext === 'ply') {
        const head = new TextDecoder().decode(u8.subarray(0, Math.min(u8.length, 4096))), m = /element\s+face\s+(\d+)/.exec(head);
        return m ? +m[1] : null;
      }
      if (ext === 'obj') {
        // (each face line: its corners less two)
        let t = 0, i = 0;
        const n = u8.length;
        while (i < n) {
          while (i < n && (u8[i] === 32 || u8[i] === 9)) i++;
          if (u8[i] === 102 && (u8[i + 1] === 32 || u8[i + 1] === 9)) {
            let c = 0, inTok = false;
            for (i += 2; i < n && u8[i] !== 10 && u8[i] !== 13; i++) { const sp = u8[i] === 32 || u8[i] === 9; if (!sp && !inTok) c++; inTok = !sp; }
            t += Math.max(0, c - 2);
          }
          while (i < n && u8[i] !== 10) i++;
          i++;
        }
        return t;
      }
      if (ext === 'fbx') {
        // a polygon's last corner is stored negative: triangles = corners - 2 x polygons
        const count = ints => { let neg = 0; for (let k = 0; k < ints.length; k++) if (ints[k] < 0) neg++; return ints.length - 2 * neg; };
        const name = 'PolygonVertexIndex';
        if (String.fromCharCode.apply(null, u8.subarray(0, 18)) === 'Kaydara FBX Binary') {
          const ZL = typeof fflate !== 'undefined' ? fflate : null;   // eslint-disable-line no-undef
          let t = 0, at = 0, found = 0;
          for (;;) {
            let i = u8.indexOf(18, at);
            if (i < 0) break;
            at = i + 1;
            let ok = true;
            for (let k = 0; k < 18 && ok; k++) ok = u8[i + 1 + k] === name.charCodeAt(k);
            if (!ok) continue;
            i += 19;
            if (u8[i] !== 105) continue;   // ('i': an array of 32-bit integers)
            const len = dv.getUint32(i + 1, true), enc = dv.getUint32(i + 5, true), clen = dv.getUint32(i + 9, true), data = u8.subarray(i + 13, i + 13 + clen);
            let raw;
            if (enc === 0) raw = data;
            else if (enc === 1 && ZL) raw = ZL.unzlibSync(data);
            else return null;
            t += count(new Int32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + len * 4)));
            found++; at = i + 13 + clen;
          }
          return found ? t : null;
        }
        const s = new TextDecoder().decode(u8);
        let t = 0, found = 0;
        for (const m of s.matchAll(/PolygonVertexIndex:\s*\*\d+\s*\{\s*a:\s*([-0-9,\s]*)\}/g)) { t += count(m[1].split(',').filter(x => x.trim()).map(Number)); found++; }
        return found ? t : null;
      }
    } catch (e) { return null; }
    return null;
  }

  // ---- a loaded model (load's result) as one binary glTF. o: { name, maxTex (its textures' longer side at most),
  // weld (true: its triangles' shared corners welded into an index), from (the original's path, for the record), fill
  // (false: its pictures' gaps not filled), keep (a share of its triangles kept), look (draw both and compare: needs
  // hooks.renderer), step(label) (progress) }. The guess goes into the file (its root's
  // scale and turn), so the GLB is in metres and Y up, as glTF is. Loaded back and compared with the original: triangles,
  // size, skins, bones, animations, and where the bones and a sample of skinned corners are at a few moments of every
  // animation. -> { ok, why, notes, before, after, check, look, sheet, glb, record, missing }. Nothing is changed on a
  // failure but the model given (its materials and geometry are made over for export: dispose it after)
  async function toGLB(m, o) {
    o = o || {};
    const step = o.step || (() => {}), maxTex = o.maxTex || 4096, notes = [];
    if (H.exporter) H.exporter();
    if (!T.GLTFExporter) throw new Error('no GLTFExporter');
    const ext = m.ext, clips = m.clips || [];
    step('Making it lighter', 0.05);
    const wrap = new T.Object3D();
    wrap.name = o.name || 'model';
    wrap.add(m.root);
    m.root.updateMatrixWorld(true);
    const box0 = new T.Box3().setFromObject(m.root), g = guessFor(m.guess, box0.getSize(new T.Vector3()));
    wrap.scale.setScalar(g.s);
    wrap.quaternion.fromArray(g.q).normalize();
    wrap.updateMatrixWorld(true);
    if (!g.gltf) {
      const unit = { unit: `${+(+g.unit).toPrecision(3)} cm a unit (the file's own)`, metres: '1 unit = 1 m', cm: 'centimetres', mm: 'millimetres', fit: 'sized to 1 m' }[g.how];
      notes.push(`units: ${g.free ? 'the file gives none, ' : g.read ? '' : 'none given (FBX\'s own, centimetres), '}${unit}: scale ${g.s}` + (g.how === 'metres' && !g.free ? ` (the file's own units would make it ${g.would} m)` : ''));
      notes.push(`up: ${['X', 'Y', 'Z'][g.up] || '?'}${g.sign < 0 ? ' (down)' : ''}${g.up === 2 ? ': stood up (a quarter turn about x)' : g.up === 0 ? ': turned about z' : g.sign < 0 ? ': turned over' : ''}`);
    }
    const before = stats(wrap, clips);
    if (m.missing && m.missing.length) notes.push(`missing texture${m.missing.length > 1 ? 's' : ''} ${m.missing.join(', ')}: converted without ${m.missing.length > 1 ? 'them' : 'it'}`);

    // materials as glTF's: Phong and Lambert (the FBX and OBJ loaders') become standard ones of the same look
    const toStd = mt => {
      if (mt.isMeshStandardMaterial || mt.isMeshBasicMaterial || !mt.isMaterial) return mt;
      const spec = mt.specular ? (mt.specular.r + mt.specular.g + mt.specular.b) / 3 : 0;
      const rough = mt.isMeshLambertMaterial || spec < 0.05 ? 1 : Math.min(1, Math.max(0.25, Math.sqrt(2 / ((mt.shininess || 30) + 2))));
      // (pictures laid on by hand in slots such a material does not use, roughness and metalness, carried over)
      const s = new T.MeshStandardMaterial({ name: mt.name, color: mt.color, map: mt.map, normalMap: mt.normalMap || null, emissive: mt.emissive, emissiveMap: mt.emissiveMap || null,
        emissiveIntensity: mt.emissiveIntensity ?? 1, aoMap: mt.aoMap || null, alphaMap: mt.alphaMap || null, opacity: mt.opacity, transparent: mt.transparent, alphaTest: mt.alphaTest,
        side: mt.side, vertexColors: mt.vertexColors, skinning: mt.skinning, morphTargets: mt.morphTargets, morphNormals: mt.morphNormals, flatShading: mt.flatShading,
        roughnessMap: mt.roughnessMap || null, metalnessMap: mt.metalnessMap || null, metalness: mt.metalnessMap ? 1 : 0, roughness: mt.roughnessMap ? 1 : rough });
      if (mt.normalScale) s.normalScale.copy(mt.normalScale);
      // a bump map (FBX's and MTL's; glTF has none) made a normal map from its slopes, when the material has none
      const bn = mt.bumpMap && !mt.normalMap ? bumpToNormal(mt.bumpMap, mt.bumpScale) : null;
      if (bn) { s.normalMap = bn; notes.push(`${mt.name || 'a material'}: its bump map made a normal map (from its slopes: glTF has no bump maps)`); }
      const left = [mt.bumpMap && !bn && 'bump', mt.specularMap && 'specular'].filter(Boolean);
      if (left.length) notes.push(`${mt.name || 'a material'}: its ${left.join(' and ')} map is left out (glTF has none)`);
      return s;
    };
    // a height picture as a normal map: its slopes (a Sobel filter over its brightness), as steep as its bumpScale says;
    // green up the picture as three.js reads a normal map the right way up (flipY), else down
    const bumpToNormal = (t, scale) => {
      const img = t.image, w0 = img && (img.naturalWidth || img.width), h0 = img && (img.naturalHeight || img.height);
      if (!w0 || !h0) return null;
      const k = Math.min(1, maxTex / Math.max(w0, h0)), w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
      const c = canvasOf(img, w, h), x = c.getContext('2d'), src = x.getImageData(0, 0, w, h).data, out = x.createImageData(w, h), d = out.data, L = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) L[i] = (0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2]) / 255;
      const at = (a, b) => L[Math.min(h - 1, Math.max(0, b)) * w + Math.min(w - 1, Math.max(0, a))];
      const K = Math.min(20, Math.max(0.05, Math.abs(scale) || 1)), up = t.flipY === false ? -1 : 1;
      for (let y = 0; y < h; y++) for (let q = 0; q < w; q++) {
        const gx = at(q + 1, y - 1) + 2 * at(q + 1, y) + at(q + 1, y + 1) - at(q - 1, y - 1) - 2 * at(q - 1, y) - at(q - 1, y + 1);
        const gy = at(q - 1, y + 1) + 2 * at(q, y + 1) + at(q + 1, y + 1) - at(q - 1, y - 1) - 2 * at(q, y - 1) - at(q + 1, y - 1);
        let nx = -gx * K, ny = gy * K * up, nz = 1;
        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        const i = (y * w + q) * 4;
        d[i] = Math.round((nx * 0.5 + 0.5) * 255); d[i + 1] = Math.round((ny * 0.5 + 0.5) * 255); d[i + 2] = Math.round((nz * 0.5 + 0.5) * 255); d[i + 3] = 255;
      }
      x.putImageData(out, 0, 0);
      const n = new T.Texture(c);
      n.flipY = t.flipY; n.wrapS = t.wrapS; n.wrapT = t.wrapT; n.name = (t.name || 'bump') + ' (normal)'; n.needsUpdate = true;
      return n;
    };
    // roughness and metalness as glTF keeps them: one picture, roughness in its green and metalness in its blue (three.js
    // reads them so too; its exporter writes them only when both slots hold the same picture, and drops them otherwise)
    const packed = new Set();
    const packRM = mt => {
      const r = mt.roughnessMap, m = mt.metalnessMap;
      if (packed.has(mt) || !(r || m) || r === m) return;
      packed.add(mt);
      const ims = [r, m].map(t => (t && t.image && (t.image.naturalWidth || t.image.width) ? t.image : null)), big = ims.filter(Boolean);
      if (!big.length) { mt.roughnessMap = mt.metalnessMap = null; return; }
      const w0 = Math.max(...big.map(i => i.naturalWidth || i.width)), h0 = Math.max(...big.map(i => i.naturalHeight || i.height)), k = Math.min(1, maxTex / Math.max(w0, h0));
      const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k)), read = i => (i ? canvasOf(i, w, h).getContext('2d').getImageData(0, 0, w, h).data : null);
      const R = read(ims[0]), M = read(ims[1]), c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d'), o2 = x.createImageData(w, h), d = o2.data;
      // (the one without a picture written as its factor, which then becomes 1: a glTF material with no metallicFactor is
      // fully metal by three.js's reading, and a roughness picture alone must not make it so)
      const f = v => Math.round(255 * Math.min(1, Math.max(0, Number.isFinite(v) ? v : 1))), fr = f(mt.roughness), fm = f(mt.metalness);
      for (let i = 0; i < w * h * 4; i += 4) { d[i] = 255; d[i + 1] = R ? R[i + 1] : fr; d[i + 2] = M ? M[i + 2] : fm; d[i + 3] = 255; }
      if (!R) mt.roughness = 1;
      if (!M) mt.metalness = 1;
      x.putImageData(o2, 0, 0);
      const t = new T.Texture(c), was = r || m;
      t.flipY = was.flipY; t.wrapS = was.wrapS; t.wrapT = was.wrapT; t.name = 'roughness and metalness'; t.needsUpdate = true;
      mt.roughnessMap = mt.metalnessMap = t;
      notes.push(`${mt.name || 'a material'}: its ${r && m ? 'roughness and metalness pictures packed into one' : (r ? 'roughness' : 'metalness') + ' picture packed as glTF keeps it'} (roughness in green, metalness in blue)`);
    };
    const canvasOf = (img, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h); return c; };
    const opaque = img => {   // any pixel that is not opaque (on a small copy: enough to tell)
      const k = Math.min(1, 512 / Math.max(img.width, img.height)), c = canvasOf(img, Math.max(1, Math.round(img.width * k)), Math.max(1, Math.round(img.height * k)));
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return false;
      return true;
    };
    let drawn = 0;
    const clear = new Set(), done = new Set(), pics = new Map();   // (pics: each picture drawn down once, though textures share it)
    wrap.traverse(n => {
      if (!n.isMesh) return;
      const ms = [].concat(n.material).map(toStd);
      n.material = Array.isArray(n.material) ? ms : ms[0];
      // a material wholly see-through with nothing to see through it by (no alpha map) is an exporter's quirk, not a wish:
      // 3ds Max writes Opacity 0 for an opaque one (the owner's figure), and three.js's FBX loader would draw nothing at all
      if (ext === 'fbx') for (const mt of ms) if (mt.opacity <= 0.01 && !mt.alphaMap) { mt.opacity = 1; mt.transparent = false; clear.add(mt.name || 'a material'); }
      for (const mt of ms) if (mt.isMeshStandardMaterial) packRM(mt);
      for (const mt of ms) for (const k of ['map', 'normalMap', 'emissiveMap', 'aoMap', 'alphaMap', 'roughnessMap', 'metalnessMap']) {
        const t = mt[k];
        if (!t || !t.isTexture) continue;
        const img = t.image, w = img && (img.naturalWidth || img.width), h = img && (img.naturalHeight || img.height);
        if (!w || !h) { mt[k] = null; continue; }   // a texture that never loaded: left out
        if (done.has(t)) continue;
        done.add(t);
        let pic = pics.get(img);
        if (!pic) {
          const k2 = Math.min(1, maxTex / Math.max(w, h));
          if (k2 < 1) drawn++;
          const cv = canvasOf(img, Math.max(1, Math.round(w * k2)), Math.max(1, Math.round(h * k2)));
          pics.set(img, pic = { cv, fmt: opaque(cv) ? T.RGBFormat : T.RGBAFormat });   // (the exporter writes RGB as JPEG, RGBA as PNG)
        }
        t.image = pic.cv; t.format = pic.fmt; t.needsUpdate = true;
      }
    });
    for (const img of pics.keys()) if (typeof img.close === 'function') img.close();   // (an ImageBitmap's memory back at once)
    if (drawn) notes.push(`${drawn} texture${drawn > 1 ? 's' : ''} drawn down to ${maxTex} px on the longer side`);
    if (clear.size) notes.push(`made opaque: ${[...clear].join(', ')} (its opacity was 0, which would show nothing: an exporter's quirk)`);
    if (!before.normals) notes.push('no normals (a scan\'s mesh): marked to be shown as scanned');
    await yieldNow();

    // the gaps between its pictures' pieces filled (fillModel), by its triangles before it is made lighter, so the lighter
    // one shows no black seams; o.fill false: not. A picture the GLB it was made from had filled already is left as it is
    let fill = null;
    if (o.fill !== false) {
      step('Filling its textures\' gaps', 0.12);
      fill = await fillModel(wrap);
      for (const f of fill.list) {
        // (made opaque where nothing reads its alpha: then written as JPEG, as an opaque one is)
        const pic = [...pics.values()].find(p => p.cv === f.canvas);
        if (pic && pic.fmt === T.RGBAFormat && opaque(f.canvas)) { pic.fmt = T.RGBFormat; for (const t of f.texs) t.format = T.RGBFormat; }
      }
      const n = fill.list.length;
      if (n) notes.push(`texture gaps filled: ${n === 1 ? 'its picture' : n + ' pictures'} (${fill.list.map(f => Math.round(f.share * 100) + ' %').join(', ')} of ${n === 1 ? 'it' : 'them'} used by its triangles) given the colours round its pieces between them, so a lighter model shows no black seams (${(fill.ms / 1000).toFixed(1)} s)`);
      await yieldNow();
    }

    // corners welded: a vertex for every distinct corner (all its attributes the same), and an index
    if (o.weld !== false) {
      step('Welding corners', 0.15);
      let was = 0, now = 0;
      const seen = new Set();
      wrap.traverse(n => {
        if (!n.isMesh || seen.has(n.geometry)) return;
        seen.add(n.geometry);
        const gm = n.geometry, w = weldOf(gm);
        if (!w) return;
        for (const [nm, a] of w.attrs) gm.setAttribute(nm, a);
        for (const [nm, i, a] of w.morphs) gm.morphAttributes[nm][i] = a;
        gm.setIndex(w.index);   // (groups keep their ranges: the index is in the old order)
        gm.boundingBox = null; gm.boundingSphere = null;
        was += w.was; now += w.now;
      });
      if (was) notes.push(`corners welded: ${was.toLocaleString('en-GB')} vertices became ${now.toLocaleString('en-GB')}`);
      await yieldNow();
    }
    // fewer triangles (o.keep under 1: the share kept), after the weld, which the simplifier needs
    let red = null;
    if (o.keep > 0 && o.keep < 1) {
      step('Fewer triangles', 0.2);
      await yieldNow();
      red = await reduce(wrap, o.keep, { inPlace: true });
      if (red.to < red.from) notes.push(...red.notes);
      else { notes.push('fewer triangles: none taken away (its parts have too few to come down)'); red = null; }   // (nothing recorded)
      await yieldNow();
    }
    const ref = o.keep > 0 && o.keep < 1 ? stats(wrap, clips) : before;   // (what the GLB must match: the lighter model)

    // animation tracks for things the file does not export (the exporter would drop the whole animation): left out
    const PATHS = { position: 1, quaternion: 1, scale: 1, morphTargetInfluences: 1 };
    const outClips = clips.map(c => {
      const keep = c.tracks.filter(tr => { const b = T.PropertyBinding.parseTrackName(tr.name); return PATHS[b.propertyName] && T.PropertyBinding.findNode(wrap, b.nodeName); });
      if (keep.length < c.tracks.length) notes.push(`${JSON.stringify(c.name)}: ${c.tracks.length - keep.length} of its ${c.tracks.length} tracks name nothing in the model (left out)`);
      return new T.AnimationClip(c.name, c.duration, keep, c.blendMode);
    });

    // where things are at a moment of an animation: every bone, and a sample of each skinned mesh's corners after skinning
    // (the original's nodes compared: its bones and what its animations move; the GLB's: every named node, since glTF's
    // loader makes a bone that is no skin's joint a plain node)
    const moving = new Set(outClips.flatMap(c => c.tracks.map(tr => T.PropertyBinding.parseTrackName(tr.name).nodeName)));
    const poseOf = (root, clip, t, all = false) => {
      const saved = [];
      root.traverse(n => saved.push([n, n.position.clone(), n.quaternion.clone(), n.scale.clone()]));
      const mixer = new T.AnimationMixer(root);
      if (clip) { mixer.clipAction(clip).play(); mixer.setTime(t); }
      root.updateMatrixWorld(true);
      const bones = new Map(), skins = [];
      root.traverse(n => {
        if (n.name && n !== root && !bones.has(n.name) && (all ? !n.isMesh : n.isBone || moving.has(n.name))) bones.set(n.name, new T.Vector3().setFromMatrixPosition(n.matrixWorld));
        if (n.isSkinnedMesh) {
          n.skeleton.update();
          const cnt = n.geometry.attributes.position.count, st = Math.max(1, Math.floor(cnt / 150)), pts = [];
          for (let i = 0; i < cnt; i += st) pts.push(n.boneTransform(i, new T.Vector3()).applyMatrix4(n.matrixWorld));
          skins.push({ n: cnt, name: n.name, pts });
        }
      });
      mixer.stopAllAction(); mixer.uncacheRoot(root);
      for (const [n, p, q, s] of saved) { n.position.copy(p); n.quaternion.copy(q); n.scale.copy(s); }   // (back at rest)
      root.updateMatrixWorld(true);
      return { bones, skins };
    };
    const restOf = (root, all) => poseOf(root, null, 0, all);
    const sampleTimes = c => [0, c.duration / 3, (2 * c.duration) / 3, c.duration * 0.999];
    const want = outClips.map(c => sampleTimes(c).map(t => poseOf(wrap, c, t)));
    const rest = restOf(wrap);

    // ---- export, and its record
    step('Writing the GLB', 0.35);
    await yieldNow();
    const t0 = performance.now();
    // (a picture the browser cannot encode, as a headset short of memory, leaves the exporter waiting for ever: a limit)
    let glb = await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('its textures could not be written here (out of memory?): try it on a laptop')), o.exportMs || 240000);
      try { new T.GLTFExporter().parse(wrap, b => { clearTimeout(t); res(b); }, { binary: true, animations: outClips, onlyVisible: false, truncateDrawRange: true, embedImages: true, maxTextureSize: maxTex }); } catch (err) { clearTimeout(t); rej(err); }
    });
    const record = { from: String(o.from || '').slice(0, 200), s: g.s, q: wrap.quaternion.toArray().map(v => Math.round(v * 1e6) / 1e6), at: Date.now() };
    if (!before.normals) record.scan = true;
    if (o.tex && o.tex.length) record.tex = texList(o.tex);
    if (red) record.tris = { from: red.from, to: red.to, keep: red.keep };
    if (fill && fill.list.length + fill.again) record.fill = fill.list.length + fill.again;
    glb = glbPatch(glb, j => { j.asset = Object.assign({}, j.asset, { extras: Object.assign({}, j.asset && j.asset.extras, { studio: record }) }); });
    const exportMs = performance.now() - t0;

    // ---- loaded back and compared
    step('Checking it', 0.75);
    await yieldNow();
    const t1 = performance.now();
    const gb = await new Promise((res, rej) => new T.GLTFLoader().parse(glb.slice(0), '', res, rej));
    const back = gb.scene, after = stats(back, gb.animations);
    after.parse = performance.now() - t1;
    const tol = Math.max(0.002, 0.005 * Math.max(...before.size)), why = [];
    if (after.tris !== ref.tris) why.push(`triangles ${ref.tris} became ${after.tris}`);
    if (after.skinned !== ref.skinned) why.push(`skinned meshes ${ref.skinned} became ${after.skinned}`);
    if (after.bones < ref.bones) why.push(`bones ${ref.bones} became ${after.bones}`);
    if (ref.size.some((v, i) => Math.abs(v - after.size[i]) > tol)) why.push(`size ${ref.size.map(v => v.toFixed(3))} became ${after.size.map(v => v.toFixed(3))}`);
    if (!glbRecord(gb.parser && gb.parser.json) && !glbRecord({ asset: gb.asset })) why.push('its record (asset.extras.studio) did not come through');
    for (const c of outClips) {
      const b = gb.animations.find(x => x.name === c.name);
      if (!b) { why.push(`the animation ${JSON.stringify(c.name)} did not come through`); continue; }
      if (Math.abs(b.duration - c.duration) > 0.01) why.push(`${JSON.stringify(c.name)} lasts ${b.duration.toFixed(2)} s, not ${c.duration.toFixed(2)} s`);
    }
    // poses: the bones by name, each original skinned mesh against the one loaded back with as many corners
    let worst = 0, compared = 0, moved = 0;   // (moved: how far the animations take things from rest, so a match means something)
    const comparePose = (a, b, label) => {
      for (const [name, p] of a.bones) { const q = b.bones.get(name); if (q) { worst = Math.max(worst, p.distanceTo(q)); compared++; } }
      const used = new Set();
      for (const s of a.skins) {
        const x = b.skins.find((y, i) => !used.has(i) && y.n === s.n && (y.name === s.name || !s.name)) || b.skins.find((y, i) => !used.has(i) && y.n === s.n);
        if (!x) { why.push(`${label}: no skinned mesh like ${s.name || 'one'} came back`); continue; }
        used.add(b.skins.indexOf(x));
        s.pts.forEach((p, i) => { worst = Math.max(worst, p.distanceTo(x.pts[i])); compared++; });
      }
    };
    comparePose(rest, restOf(back, true), 'at rest');
    outClips.forEach((c, ci) => {
      const b = gb.animations.find(x => x.name === c.name);
      for (const w of want[ci]) for (const [name, p] of w.bones) { const r = rest.bones.get(name); if (r) moved = Math.max(moved, p.distanceTo(r)); }
      if (b) sampleTimes(c).forEach((t, ti) => comparePose(want[ci][ti], poseOf(back, b, t, true), `${c.name} at ${t.toFixed(2)} s`));
    });
    if (worst > tol) why.push(`bones or skinned corners move differently: up to ${(worst * 100).toFixed(1)} cm apart (more than ${(tol * 100).toFixed(1)} cm)`);
    const check = !compared ? 'no bones or animations to compare: triangles and size' : `${compared.toLocaleString('en-GB')} bone and skinned-corner positions at rest and at ${outClips.length * 4} moments of ${outClips.length} animation${outClips.length === 1 ? '' : 's'}: at most ${(worst * 1000).toFixed(2)} mm apart` +
      (outClips.length ? ` (the animations move them up to ${(moved * 100).toFixed(0)} cm from rest)` : '');

    // how it looks (convert.mjs only): the original (with the materials it is exported with) and the GLB drawn from the
    // same three places, lit evenly (an ambient light alone shows a texture's own colours), colour textures as sRGB on both
    // sides (glTF's rule; the FBX loader leaves them linear), and the pictures compared, channel by channel
    let look = '', sheet = '';
    if (o.look && H.renderer) {
      try {
        const W = 320, Hh = 200, r = H.renderer(W, Hh);
        r.outputEncoding = T.sRGBEncoding;
        // (and a mesh without normals flat-shaded, as glTF's loader shows one: lit, it would otherwise draw black)
        wrap.traverse(n => {
          for (const mt of [].concat(n.material || [])) {
            for (const k of ['map', 'emissiveMap']) if (mt[k]) { mt[k].encoding = T.sRGBEncoding; mt.needsUpdate = true; }
            if (n.isMesh && !n.geometry.attributes.normal) { mt.flatShading = true; mt.needsUpdate = true; }
          }
        });
        // (framed on what is drawn: a skinned mesh by its corners as skinned, which its geometry's box does not follow)
        const box = new T.Box3(), v = new T.Vector3();
        wrap.updateMatrixWorld(true);
        wrap.traverse(n => {
          if (!n.isMesh) return;
          if (!n.isSkinnedMesh) { n.geometry.computeBoundingBox(); box.union(n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld)); return; }
          n.skeleton.update();
          const cnt = n.geometry.attributes.position.count;
          for (let i = 0; i < cnt; i += Math.max(1, Math.floor(cnt / 5000))) box.expandByPoint(n.boneTransform(i, v).applyMatrix4(n.matrixWorld));
        });
        const c = box.getCenter(new T.Vector3()), R = Math.max(1e-3, box.getSize(new T.Vector3()).length() / 2);
        const cam = new T.PerspectiveCamera(50, W / Hh, R / 200, R * 20), dirs = [[1, 0.7, 1.2], [-1.2, 0.5, -0.8], [0.15, 1.6, 0.25]];
        const draw = obj => dirs.map(d => {
          const sc = new T.Scene(), parent = obj.parent;
          sc.add(new T.AmbientLight(0xffffff, 1)); sc.add(obj);
          cam.position.copy(c).add(new T.Vector3(...d).normalize().multiplyScalar(R * 1.9)); cam.lookAt(c); cam.updateProjectionMatrix();
          r.render(sc, cam);
          const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; cv.getContext('2d').drawImage(r.domElement, 0, 0);
          sc.remove(obj); if (parent) parent.add(obj);
          return cv;
        });
        const A = draw(wrap), B = draw(back);
        let dsum = 0, cnt = 0, lit = 0;
        A.forEach((a, i) => {
          const x = a.getContext('2d').getImageData(0, 0, W, Hh).data, y = B[i].getContext('2d').getImageData(0, 0, W, Hh).data;
          for (let k = 0; k < x.length; k += 4) { for (let j = 0; j < 3; j++) dsum += Math.abs(x[k + j] - y[k + j]); cnt += 3; if (x[k] + x[k + 1] + x[k + 2] > 0) lit++; }
        });
        const mean = dsum / cnt, cover = lit / (cnt / 3);
        const S = document.createElement('canvas'); S.width = W * 3; S.height = Hh * 2;
        const sx = S.getContext('2d');
        A.forEach((a, i) => sx.drawImage(a, i * W, 0)); B.forEach((b, i) => sx.drawImage(b, i * W, Hh));
        sheet = S.toDataURL('image/png');
        look = `drawn from three sides, the GLB differs from the original by ${mean.toFixed(2)} of 255 on average (it covers ${(cover * 100).toFixed(0)} % of the pictures)`;
        if (mean > 12) why.push(`it looks different: ${mean.toFixed(1)} of 255 on average from the original`);
        if (cover < 0.005) why.push('nothing shows when it is drawn');
        r.dispose();
      } catch (err) { look = 'not drawn (' + err.message + ')'; }
    }
    disposeTree(back);
    wrap.remove(m.root);
    step(why.length ? 'Not written' : 'Converted', 1);
    return { ok: !why.length, why: why.join('; '), notes, before, after, check, look, sheet, glb, record, missing: m.missing || [], ms: { export: Math.round(exportMs), back: Math.round(after.parse) },
      reduced: red ? { from: red.from, to: red.to, keep: red.keep, morph: red.morph, ms: red.ms } : null };
  }

  return { fbxGuess, guessFor, namesIn, mtlNames, load, toGLB, glbJSON, glbPatch, glbRecord, texList, stats, disposeTree, MODEL_EXT, reduce, weldOf, triCount, KEEP_MIN, fillModel, filled, FILL_SLOTS,
    IM, texFind: IM.texFind, texRank: IM.texRank, slotOf: IM.slotOf, normStem: IM.normStem, picture, toImage, meanOf, matsOf, addTextures };
}

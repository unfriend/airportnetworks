// ================================================================ CONVERT ==
// The converter (tools/studio/SPEC.md, "GLB first, and converting"): one module in two places, the studio's page (its
// Convert to GLB and the Upload pane; pasted into stories/studio.js by tools/studio/build.mjs) and
// tools/studio/convert.mjs (in its headless page). Nothing in it knows where files come from: the caller says how a name
// a model gives becomes an address (url). makeConverter(THREE, hooks) gives:
//   fbxGuess(buf)       an FBX's units and up axis, read from its bytes (three.js's loader ignores them)
//   guessFor(g, size)   the scale and turn a model starts with (the studio's guess; a GLB has it baked in)
//   namesIn(ext, buf), mtlNames(text)   the files a model names (textures, an OBJ's MTL, a glTF's buffers), unloaded
//   load(o)             a model read: FBX, glTF/GLB, OBJ (with its MTL), PLY, STL -> { root, clips, guess, asset, missing }
//   toGLB(m, o)         a loaded model as one binary glTF in metres and Y up, loaded back and checked against it
//   glbJSON(buf), glbPatch(buf, fn), glbRecord(json)   a GLB's JSON chunk, changed, and its asset.extras.studio
// hooks.exporter(): defines THREE.GLTFExporter (the studio does so only when converting); hooks.renderer(w, h): a WebGL
// renderer for drawing both to compare their looks (convert.mjs only: the app's one renderer is the shell's)
function makeConverter(THREE, hooks) {
  const T = THREE, H = hooks || {};
  const AX = new T.Vector3(1, 0, 0), AZ = new T.Vector3(0, 0, 1);
  const yieldNow = () => new Promise(r => setTimeout(r, 0));
  const baseOf = p => String(p).split(/[?#]/)[0].split(/[\\/]/).pop();
  const MODEL_EXT = ['fbx', 'glb', 'gltf', 'obj', 'ply', 'stl'];
  const TEX_KEYS = ['map', 'normalMap', 'emissiveMap', 'aoMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'specularMap', 'bumpMap', 'lightMap'];
  // what a texture not found becomes while the model loads: a tiny white picture (3 x 1, so it is told apart), dropped after
  let missingUrl = '';
  const MISSING = () => missingUrl || (missingUrl = (() => { const c = document.createElement('canvas'); c.width = 3; c.height = 1; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 3, 1); return c.toDataURL(); })());

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
        for (const im of j.images || []) if (im && typeof im.uri === 'string' && !/^data:/i.test(im.uri)) add(out.textures, decodeURIComponent(im.uri));
      }
    }
    return out;
  }
  // an MTL's textures (map_Kd, bump, norm...: the last of its words after the options)
  const MTL_OPT = { '-bm': 1, '-blendu': 1, '-blendv': 1, '-boost': 1, '-cc': 1, '-clamp': 1, '-imfchan': 1, '-texres': 1, '-type': 1, '-mm': 2, '-o': 3, '-s': 3, '-t': 3 };
  function mtlNames(text) {
    const out = [];
    for (const m of String(text).matchAll(/^[ \t]*(map_\w+|bump|norm|disp|decal|refl)[ \t]+(.+?)[ \t]*$/gim)) {
      const w = m[2].split(/\s+/);
      let i = 0;
      while (i < w.length && MTL_OPT[w[i].toLowerCase()] !== undefined) i += 1 + MTL_OPT[w[i].toLowerCase()];
      const n = baseOf(w.slice(i).join(' '));
      if (n && !out.some(x => x.toLowerCase() === n.toLowerCase())) out.push(n);
    }
    return out;
  }
  const mtllibs = text => [...String(text).matchAll(/^[ \t]*mtllib[ \t]+(.+?)[ \t]*$/gim)].map(m => m[1]);

  // ---- a model read. o: { ext, data (ArrayBuffer), base (the address its names are relative to), url(name) -> an
  // address or null (not found: it loads untextured and missing says so) }
  async function load(o) {
    const ext = String(o.ext).toLowerCase(), manager = new T.LoadingManager(), W = { n: 0, done: null }, missing = new Set();
    // what the model asks for (textures, a .gltf's buffers): it is ready once each has come or failed (the manager's own
    // counters are private)
    const s0 = manager.itemStart.bind(manager), e0 = manager.itemEnd.bind(manager);
    manager.itemStart = u => { W.n++; s0(u); };
    manager.itemEnd = u => { e0(u); if (--W.n <= 0 && W.done) W.done(); };
    const named = u => {
      if (/^(blob|data):/i.test(u)) return u;
      const r = o.url(u);
      if (r) return r;
      const n = baseOf(u);
      if (n && n !== 'undefined') missing.add(n);   // (the FBX loader asks for 'undefined' when a texture names no image)
      return MISSING();
    };
    manager.setURLModifier(named);
    if (T.TGALoader) manager.addHandler(/\.tga$/i, new T.TGALoader(manager));
    const settle = () => new Promise(res => { if (W.n <= 0) res(); else { W.done = res; setTimeout(res, 60000); } });
    let root = null, clips = [], guess, asset = null;
    const u8 = new Uint8Array(o.data);
    if (ext === 'fbx') {
      guess = fbxGuess(o.data);
      root = new T.FBXLoader(manager).parse(o.data, o.base);
      clips = root.animations || [];
    } else if (ext === 'glb' || ext === 'gltf') {
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
      if (mtl) { const mc = new T.MTLLoader(manager).parse(mtl, o.base); mc.preload(); loader.setMaterials(mc); }
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
      }
    });
    for (const im of images) if (im.decode) { try { await im.decode(); } catch (e) { /* drawn as it is */ } }
    return { root, clips, guess, asset, missing: [...missing], ext };
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
  // asset.extras.studio: { from: the original's path, s: the scale baked in, q: the turn baked in, at: ms, scan: no normals }
  function glbRecord(j) {
    const r = j && j.asset && j.asset.extras && j.asset.extras.studio;
    if (!r || typeof r !== 'object') return null;
    const q = Array.isArray(r.q) && r.q.length === 4 && r.q.every(Number.isFinite) ? r.q : [0, 0, 0, 1];
    return { from: typeof r.from === 'string' ? r.from.slice(0, 200) : '', s: Number.isFinite(r.s) && r.s > 0 ? r.s : 1, q, at: +r.at || 0, scan: !!r.scan };
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

  // ---- a loaded model (load's result) as one binary glTF. o: { name, maxTex (its textures' longer side at most),
  // weld (true: its triangles' shared corners welded into an index), from (the original's path, for the record), look
  // (draw both and compare: needs hooks.renderer), step(label) (progress) }. The guess goes into the file (its root's
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
      const s = new T.MeshStandardMaterial({ name: mt.name, color: mt.color, map: mt.map, normalMap: mt.normalMap || null, emissive: mt.emissive, emissiveMap: mt.emissiveMap || null,
        emissiveIntensity: mt.emissiveIntensity ?? 1, aoMap: mt.aoMap || null, alphaMap: mt.alphaMap || null, opacity: mt.opacity, transparent: mt.transparent, alphaTest: mt.alphaTest,
        side: mt.side, vertexColors: mt.vertexColors, skinning: mt.skinning, morphTargets: mt.morphTargets, morphNormals: mt.morphNormals, flatShading: mt.flatShading, metalness: 0, roughness: rough });
      if (mt.normalScale) s.normalScale.copy(mt.normalScale);
      if (mt.bumpMap || mt.specularMap) notes.push(`${mt.name || 'a material'}: its ${[mt.bumpMap && 'bump', mt.specularMap && 'specular'].filter(Boolean).join(' and ')} map is left out (glTF has none)`);
      return s;
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

    // corners welded: a vertex for every distinct corner (all its attributes the same), and an index
    if (o.weld !== false) {
      step('Welding corners', 0.15);
      let was = 0, now = 0;
      const seen = new Set();
      wrap.traverse(n => {
        if (!n.isMesh || seen.has(n.geometry)) return;
        seen.add(n.geometry);
        const gm = n.geometry;
        if (gm.index) return;
        const attrs = Object.entries(gm.attributes), morphs = Object.entries(gm.morphAttributes || {}).flatMap(([nm, list]) => list.map((a, i) => [nm, i, a]));
        if ([...attrs.map(a => a[1]), ...morphs.map(x => x[2])].some(a => a.isInterleavedBufferAttribute)) return;
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
        if (first.length === cnt) return;
        const pick = a => { const s = a.itemSize, arr = new a.array.constructor(first.length * s); for (let i = 0; i < first.length; i++) for (let j = 0; j < s; j++) arr[i * s + j] = a.array[first[i] * s + j]; return new T.BufferAttribute(arr, s, a.normalized); };
        for (const [nm, a] of attrs) gm.setAttribute(nm, pick(a));
        for (const [nm, i, a] of morphs) gm.morphAttributes[nm][i] = pick(a);
        gm.setIndex(new T.BufferAttribute(first.length < 65536 ? new Uint16Array(remap) : remap, 1));   // (groups keep their ranges: the index is in the old order)
        gm.boundingBox = null; gm.boundingSphere = null;
        was += cnt; now += first.length;
      });
      if (was) notes.push(`corners welded: ${was.toLocaleString('en-GB')} vertices became ${now.toLocaleString('en-GB')}`);
      await yieldNow();
    }

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
    let glb = await new Promise((res, rej) => {
      try { new T.GLTFExporter().parse(wrap, res, { binary: true, animations: outClips, onlyVisible: false, truncateDrawRange: true, embedImages: true, maxTextureSize: maxTex }); } catch (err) { rej(err); }
    });
    const record = { from: String(o.from || '').slice(0, 200), s: g.s, q: wrap.quaternion.toArray().map(v => Math.round(v * 1e6) / 1e6), at: Date.now() };
    if (!before.normals) record.scan = true;
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
    if (after.tris !== before.tris) why.push(`triangles ${before.tris} became ${after.tris}`);
    if (after.skinned !== before.skinned) why.push(`skinned meshes ${before.skinned} became ${after.skinned}`);
    if (after.bones < before.bones) why.push(`bones ${before.bones} became ${after.bones}`);
    if (before.size.some((v, i) => Math.abs(v - after.size[i]) > tol)) why.push(`size ${before.size.map(v => v.toFixed(3))} became ${after.size.map(v => v.toFixed(3))}`);
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
    return { ok: !why.length, why: why.join('; '), notes, before, after, check, look, sheet, glb, record, missing: m.missing || [], ms: { export: Math.round(exportMs), back: Math.round(after.parse) } };
  }

  return { fbxGuess, guessFor, namesIn, mtlNames, load, toGLB, glbJSON, glbPatch, glbRecord, stats, disposeTree, MODEL_EXT };
}
